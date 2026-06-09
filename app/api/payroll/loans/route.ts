import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import LoanAdvance from "@/models/LoanAdvance";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

export const loanSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  type: z.enum(["loan", "advance"]).optional(),
  // Money fields are minor units.
  principal: z.number().int().min(0),
  installmentAmount: z.number().int().min(0),
  remainingBalance: z.number().int().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  status: z.enum(["active", "closed"]).optional(),
  startDate: z.string().optional(),
  note: z.string().max(500).optional(),
});

export const GET = withTenant("GET /api/payroll/loans", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") || "";
  const status = searchParams.get("status") || "";
  const query: Record<string, unknown> = {};
  if (employeeId) query.employeeId = employeeId;
  if (status === "active" || status === "closed") query.status = status;
  const data = await LoanAdvance.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ success: true, data });
});

export const POST = withTenant("POST /api/payroll/loans", async (req: NextRequest, _ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;
    const parsed = loanSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    const { startDate, remainingBalance, principal, ...rest } = parsed.data;
    const loan = await LoanAdvance.create({
      ...rest,
      principal,
      remainingBalance: remainingBalance ?? principal,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
    });
    void recordAudit({ req, session, action: "create", resource: "loan_advance", resource_id: String(loan._id), resource_label: loan.type, after: loan.toObject() });
    return NextResponse.json({ success: true, data: loan }, { status: 201 });
  } catch (err) {
    console.error("[loans POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create loan/advance" }, { status: 500 });
  }
});
