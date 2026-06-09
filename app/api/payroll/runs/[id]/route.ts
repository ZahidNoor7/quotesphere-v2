import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayrollRun, { type IPayrollRun } from "@/models/PayrollRun";
import PayPeriod from "@/models/PayPeriod";
import Payslip from "@/models/Payslip";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withTenant("GET /api/payroll/runs/[id]", async (_req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const run = await PayrollRun.findById(id).populate("payPeriodId", "label startDate endDate payDate status").lean();
  if (!run) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: run });
});

// Cancel a run (frees the period). Allowed for draft / pending_approval / approved —
// never for a paid run. Loan balances are only touched at mark-paid, so cancelling
// needs no reversal; it just deletes the draft payslips and reopens the period.
export const DELETE = withTenant("DELETE /api/payroll/runs/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  const run = (await PayrollRun.findById(id).lean()) as (IPayrollRun & { _id: unknown }) | null;
  if (!run) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (run.status === "paid") return NextResponse.json({ success: false, error: "A paid run cannot be cancelled" }, { status: 409 });
  if (run.status === "cancelled") return NextResponse.json({ success: false, error: "Run is already cancelled" }, { status: 409 });

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await PayrollRun.updateOne({ _id: id }, { $set: { status: "cancelled" }, $unset: { period_lock: "" } }, { session: dbSession });
      await Payslip.deleteMany({ payrollRunId: id }, { session: dbSession });
      await PayPeriod.updateOne({ _id: run.payPeriodId, status: "processing" }, { $set: { status: "open" } }, { session: dbSession });
    });
  } catch (err) {
    console.error("[payroll runs DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to cancel run" }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }

  void recordAudit({ req, session, action: "update", resource: "payroll_run", resource_id: id, resource_label: run.run_no, after: { status: "cancelled" } });
  return NextResponse.json({ success: true });
});
