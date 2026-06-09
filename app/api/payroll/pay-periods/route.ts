import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayPeriod from "@/models/PayPeriod";

export const payPeriodSchema = z
  .object({
    label: z.string().min(1).max(80),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    payDate: z.string().min(1),
    status: z.enum(["open", "processing", "closed"]).optional(),
  })
  .refine((v) => new Date(v.startDate) <= new Date(v.endDate), { message: "Start date must be on or before end date", path: ["endDate"] });

export const GET = withTenant("GET /api/payroll/pay-periods", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const query: Record<string, unknown> = {};
  if (status === "open" || status === "processing" || status === "closed") query.status = status;
  const data = await PayPeriod.find(query).sort({ startDate: -1 }).lean();
  return NextResponse.json({ success: true, data });
});

export const POST = withTenant("POST /api/payroll/pay-periods", async (req: NextRequest, _ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;
    const parsed = payPeriodSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    const { label, startDate, endDate, payDate, status } = parsed.data;
    const period = await PayPeriod.create({
      label,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      payDate: new Date(payDate),
      ...(status ? { status } : {}),
    });
    void recordAudit({ req, session, action: "create", resource: "pay_period", resource_id: String(period._id), resource_label: period.label, after: period.toObject() });
    return NextResponse.json({ success: true, data: period }, { status: 201 });
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) return NextResponse.json({ success: false, error: "A pay period with these dates already exists" }, { status: 409 });
    console.error("[pay-periods POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create pay period" }, { status: 500 });
  }
});
