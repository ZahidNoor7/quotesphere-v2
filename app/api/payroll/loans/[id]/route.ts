import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import LoanAdvance from "@/models/LoanAdvance";
import Payslip from "@/models/Payslip";

// `remainingBalance` is intentionally NOT editable here — it is server-derived and
// only ever decremented atomically at payroll mark-paid (lib/payroll mark-paid).
// Letting it be set directly would orphan applied payslip deductions.
const updateSchema = z.object({
  type: z.enum(["loan", "advance"]).optional(),
  principal: z.number().int().min(0).optional(),
  installmentAmount: z.number().int().min(0).optional(),
  status: z.enum(["active", "closed"]).optional(),
  startDate: z.string().optional(),
  note: z.string().max(500).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = withTenant("GET /api/payroll/loans/[id]", async (_req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const loan = await LoanAdvance.findById(id).lean();
  if (!loan) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: loan });
});

export const PUT = withTenant("PUT /api/payroll/loans/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });

  const loan = await LoanAdvance.findById(id);
  if (!loan) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  // Once a loan has been deducted on a PAID payslip its ledger is frozen — only
  // the free-text note may change, so historical deductions stay consistent.
  const paidApplication = await Payslip.findOne({ "appliedLoans.loanId": id, paymentStatus: "paid" })
    .select("_id").lean();
  if (paidApplication) {
    const onlyNote = Object.keys(parsed.data).every((k) => k === "note");
    if (!onlyNote) {
      return NextResponse.json(
        { success: false, error: "This loan has paid deductions and can no longer be edited (only its note)." },
        { status: 409 },
      );
    }
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.startDate) data.startDate = new Date(data.startDate as string);
  const before = loan.toObject();
  Object.assign(loan, data);
  await loan.save();
  void recordAudit({ req, session, action: "update", resource: "loan_advance", resource_id: id, resource_label: loan.type, before, after: loan.toObject() });
  return NextResponse.json({ success: true, data: loan });
});

export const DELETE = withTenant("DELETE /api/payroll/loans/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const loan = (await LoanAdvance.findById(id).lean()) as { type?: string } | null;
  if (!loan) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await LoanAdvance.findByIdAndDelete(id);
  void recordAudit({ req, session, action: "delete", resource: "loan_advance", resource_id: id, resource_label: loan.type ?? id });
  return NextResponse.json({ success: true });
});
