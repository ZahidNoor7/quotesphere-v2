import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayrollConfig from "@/models/PayrollConfig";
import Settings from "@/models/Settings";
import { defaultPayrollConfig } from "@/lib/payroll/defaults";

const slabSchema = z.object({
  minAnnual: z.number().int().min(0),
  maxAnnual: z.number().int().min(0).nullable(),
  fixedAmount: z.number().int().min(0),
  ratePercent: z.number().min(0).max(100),
});

const configSchema = z.object({
  taxYearLabel: z.string().max(40).optional(),
  taxSlabs: z.array(slabSchema).optional(),
  eobi: z
    .object({
      enabled: z.boolean(),
      employeeRate: z.number().min(0).max(100),
      employerRate: z.number().min(0).max(100),
      minWage: z.number().int().min(0),
    })
    .optional(),
  providentFund: z
    .object({
      enabled: z.boolean(),
      employeeRate: z.number().min(0).max(100),
      employerRate: z.number().min(0).max(100),
    })
    .optional(),
  statutory: z.object({ taxEnabled: z.boolean() }).optional(),
});

export const GET = withTenant("GET /api/payroll/config", async (_req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  let config = await PayrollConfig.findOne({}).lean();
  if (!config) {
    const settings = (await Settings.findOne({}).select("default_currency").lean()) as { default_currency?: string } | null;
    config = (await PayrollConfig.create(defaultPayrollConfig(settings?.default_currency || "PKR"))).toObject();
  }
  return NextResponse.json({ success: true, data: config });
});

export const PUT = withTenant("PUT /api/payroll/config", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const parsed = configSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  const config = await PayrollConfig.findOneAndUpdate(
    {},
    { $set: parsed.data },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  void recordAudit({ req, session, action: "update", resource: "payroll_config", resource_id: "payroll_config", resource_label: "Payroll config", after: config });
  return NextResponse.json({ success: true, data: config });
});
