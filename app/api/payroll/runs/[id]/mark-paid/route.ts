import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayrollRun, { type IPayrollRun } from "@/models/PayrollRun";
import PayPeriod from "@/models/PayPeriod";
import Payslip from "@/models/Payslip";
import LoanAdvance from "@/models/LoanAdvance";

type Ctx = { params: Promise<{ id: string }> };

// approved → paid. Atomically: flip the run + every payslip to paid, decrement loan
// balances by the amounts actually applied on each slip (money moves only now), and
// close the pay period.
export const POST = withTenant("POST /api/payroll/runs/[id]/mark-paid", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  const dbSession = await mongoose.startSession();
  let run: IPayrollRun | null = null;
  let notFound = false;
  let wrongState = false;
  try {
    await dbSession.withTransaction(async () => {
      const existing = await PayrollRun.findById(id).session(dbSession);
      if (!existing) { notFound = true; throw new Error("abort"); }
      if (existing.status !== "approved") { wrongState = true; throw new Error("abort"); }

      const paidAt = new Date();
      existing.status = "paid";
      existing.paidAt = paidAt;
      await existing.save({ session: dbSession });
      run = existing;

      await Payslip.updateMany({ payrollRunId: id }, { $set: { paymentStatus: "paid", paidAt } }, { session: dbSession });

      // Decrement loan balances by what each payslip actually deducted.
      const slips = await Payslip.find({ payrollRunId: id }).select("appliedLoans").session(dbSession).lean();
      for (const s of slips) {
        for (const al of s.appliedLoans ?? []) {
          const loan = await LoanAdvance.findById(al.loanId).session(dbSession);
          if (!loan) continue;
          loan.remainingBalance = Math.max(0, loan.remainingBalance - al.amount);
          if (loan.remainingBalance <= 0) loan.status = "closed";
          await loan.save({ session: dbSession });
        }
      }

      await PayPeriod.updateOne({ _id: existing.payPeriodId }, { $set: { status: "closed" } }, { session: dbSession });
    });
  } catch (err) {
    if (notFound) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (wrongState) return NextResponse.json({ success: false, error: "Only an approved run can be marked paid" }, { status: 409 });
    console.error("[payroll runs mark-paid]", err);
    return NextResponse.json({ success: false, error: "Failed to mark run as paid" }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }

  const paid = run as unknown as IPayrollRun;
  void recordAudit({ req, session, action: "update", resource: "payroll_run", resource_id: id, resource_label: paid.run_no, after: { status: "paid" } });
  return NextResponse.json({ success: true, data: paid });
});
