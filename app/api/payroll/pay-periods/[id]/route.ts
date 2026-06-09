import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayPeriod from "@/models/PayPeriod";
import PayrollRun from "@/models/PayrollRun";

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  payDate: z.string().optional(),
  status: z.enum(["open", "processing", "closed"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = withTenant("GET /api/payroll/pay-periods/[id]", async (_req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const period = await PayPeriod.findById(id).lean();
  if (!period) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: period });
});

export const PUT = withTenant("PUT /api/payroll/pay-periods/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });

    const period = await PayPeriod.findById(id);
    if (!period) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const data: Record<string, unknown> = { ...parsed.data };
    for (const k of ["startDate", "endDate", "payDate"] as const) {
      if (data[k]) data[k] = new Date(data[k] as string);
    }
    const before = period.toObject();
    Object.assign(period, data);
    await period.save();
    void recordAudit({ req, session, action: "update", resource: "pay_period", resource_id: id, resource_label: period.label, before, after: period.toObject() });
    return NextResponse.json({ success: true, data: period });
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) return NextResponse.json({ success: false, error: "A pay period with these dates already exists" }, { status: 409 });
    console.error("[pay-periods PUT]", err);
    return NextResponse.json({ success: false, error: "Failed to update pay period" }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/payroll/pay-periods/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  const runs = await PayrollRun.countDocuments({ payPeriodId: id, status: { $ne: "cancelled" } });
  if (runs > 0) {
    return NextResponse.json({ success: false, error: "This period has a payroll run. Cancel the run before deleting the period." }, { status: 409 });
  }
  const period = (await PayPeriod.findById(id).lean()) as { label?: string } | null;
  if (!period) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await PayPeriod.findByIdAndDelete(id);
  void recordAudit({ req, session, action: "delete", resource: "pay_period", resource_id: id, resource_label: period.label ?? id });
  return NextResponse.json({ success: true });
});
