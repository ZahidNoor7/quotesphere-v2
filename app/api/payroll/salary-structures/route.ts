import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import SalaryStructure from "@/models/SalaryStructure";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

const componentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["earning", "deduction"]),
  calculation: z.enum(["fixed", "percentage_of_basic"]),
  // `fixed` → minor units; `percentage_of_basic` → a percent (0–100).
  value: z.number().min(0),
  isBasic: z.boolean().optional(),
  taxable: z.boolean().optional(),
});

export const structureSchema = z.object({
  name: z.string().min(1).max(160),
  currency: z.enum(CURRENCIES).optional(),
  active: z.boolean().optional(),
  components: z.array(componentSchema).default([]),
});

export const GET = withTenant("GET /api/payroll/salary-structures", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";
  const query: Record<string, unknown> = {};
  if (activeOnly) query.active = true;
  const data = await SalaryStructure.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ success: true, data });
});

export const POST = withTenant("POST /api/payroll/salary-structures", async (req: NextRequest, _ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;
    const parsed = structureSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    const structure = await SalaryStructure.create(parsed.data);
    void recordAudit({ req, session, action: "create", resource: "salary_structure", resource_id: String(structure._id), resource_label: structure.name, after: structure.toObject() });
    return NextResponse.json({ success: true, data: structure }, { status: 201 });
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: number };
    if (e.name === "ValidationError") return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    if (e.code === 11000) return NextResponse.json({ success: false, error: "A salary structure with this name already exists" }, { status: 409 });
    console.error("[salary-structures POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create salary structure" }, { status: 500 });
  }
});
