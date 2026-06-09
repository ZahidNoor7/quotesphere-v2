import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayrollRun, { type IPayrollRun } from "@/models/PayrollRun";
import PayPeriod from "@/models/PayPeriod";
import Payslip from "@/models/Payslip";
import Employee from "@/models/Employee";
import SalaryStructure from "@/models/SalaryStructure";
import LoanAdvance from "@/models/LoanAdvance";
import PayrollConfig, { type IPayrollConfig } from "@/models/PayrollConfig";
import Settings from "@/models/Settings";
import { defaultPayrollConfig } from "@/lib/payroll/defaults";
import { buildRunPayslips, type RunEmployee, type RunStructure, type RunLoan } from "@/lib/payroll/run";
import type { PayrollEngineConfig } from "@/lib/payroll/types";

const createSchema = z.object({
  payPeriodId: z.string().min(1, "Pay period is required"),
  employeeIds: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
});

export const GET = withTenant("GET /api/payroll/runs", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  const data = await PayrollRun.find(query)
    .sort({ createdAt: -1 })
    .populate("payPeriodId", "label startDate endDate payDate status")
    .lean();
  return NextResponse.json({ success: true, data });
});

export const POST = withTenant("POST /api/payroll/runs", async (req: NextRequest, _ctx, { session, userId }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  const { payPeriodId, employeeIds, notes } = parsed.data;
  if (!isValidObjectId(payPeriodId)) return NextResponse.json({ success: false, error: "Invalid pay period" }, { status: 400 });

  // Validate the period.
  const period = (await PayPeriod.findById(payPeriodId).lean()) as { status: string } | null;
  if (!period) return NextResponse.json({ success: false, error: "Pay period not found" }, { status: 404 });
  if (period.status === "closed") return NextResponse.json({ success: false, error: "This pay period is closed" }, { status: 400 });

  // Friendly fast-path for the race guard (partial unique index is the hard guarantee).
  const existing = await PayrollRun.findOne({ payPeriodId, status: { $ne: "cancelled" } }).select("_id").lean();
  if (existing) return NextResponse.json({ success: false, error: "A payroll run already exists for this period" }, { status: 409 });

  // Config (lazy seed) + base currency + FX snapshot.
  let configDoc = (await PayrollConfig.findOne({}).lean()) as IPayrollConfig | null;
  const settings = (await Settings.findOne({}).select("default_currency currencyRates").lean()) as
    | { default_currency?: string; currencyRates?: { rates?: Record<string, number> } }
    | null;
  if (!configDoc) {
    configDoc = (await PayrollConfig.create(defaultPayrollConfig(settings?.default_currency || "PKR"))).toObject() as IPayrollConfig;
  }
  const base = settings?.default_currency || configDoc.currency || "PKR";
  const rates = settings?.currencyRates?.rates ?? {};
  const config: PayrollEngineConfig = {
    taxEnabled: configDoc.statutory?.taxEnabled ?? true,
    taxSlabs: configDoc.taxSlabs ?? [],
    eobi: configDoc.eobi,
    providentFund: configDoc.providentFund,
    configCurrency: base,
  };

  // Active employees (optionally filtered), their structures, and active loans.
  const empQuery: Record<string, unknown> = { status: "active" };
  if (employeeIds?.length) empQuery._id = { $in: employeeIds };
  const employees = (await Employee.find(empQuery).lean()) as unknown as RunEmployee[];
  if (employees.length === 0) return NextResponse.json({ success: false, error: "No active employees to run payroll for" }, { status: 400 });

  const structIds = [...new Set(employees.map((e) => e.salaryStructureId).filter(Boolean).map(String))];
  const structures = (await SalaryStructure.find({ _id: { $in: structIds } }).lean()) as unknown as RunStructure[];
  const structuresById = new Map(structures.map((s) => [String(s._id), s]));

  const loans = (await LoanAdvance.find({
    employeeId: { $in: employees.map((e) => e._id) },
    status: "active",
    remainingBalance: { $gt: 0 },
  }).lean()) as unknown as Array<RunLoan & { employeeId: unknown }>;
  const loansByEmployee = new Map<string, RunLoan[]>();
  for (const l of loans) {
    const k = String(l.employeeId);
    if (!loansByEmployee.has(k)) loansByEmployee.set(k, []);
    loansByEmployee.get(k)!.push(l);
  }

  // Pure compute — may throw on a missing FX rate (→ 400 before any write).
  let built;
  try {
    built = buildRunPayslips({ employees, structuresById, loansByEmployee, config, fx: { base, rates } });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message || "Calculation failed" }, { status: 400 });
  }
  if (built.payslips.length === 0) {
    return NextResponse.json({ success: false, error: "No employees have a salary structure assigned", details: built.skipped }, { status: 400 });
  }

  // Persist run + payslips + flip the period — atomically.
  const dbSession = await mongoose.startSession();
  let run: IPayrollRun | null = null;
  try {
    await dbSession.withTransaction(async () => {
      run = new PayrollRun({
        payPeriodId,
        status: "draft",
        createdBy: userId,
        period_lock: payPeriodId,
        fxRateUsed: { base, rates, capturedAt: new Date() },
        totals: built.totals,
        notes,
      });
      await run.save({ session: dbSession });

      // create() (not insertMany) so each payslip runs the tenant plugin's validate
      // hook that stamps org_id; the unique (org_id,run,employee) index still enforces
      // one-slip-per-employee idempotency.
      await Payslip.create(
        built.payslips.map((p) => ({ ...p, payrollRunId: run!._id, payPeriodId, paymentStatus: "unpaid" })),
        { session: dbSession, ordered: true },
      );

      await PayPeriod.updateOne({ _id: payPeriodId }, { $set: { status: "processing" } }, { session: dbSession });
    });
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) return NextResponse.json({ success: false, error: "A payroll run already exists for this period" }, { status: 409 });
    console.error("[payroll runs POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create payroll run" }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }

  const created = run as unknown as IPayrollRun;
  void recordAudit({
    req,
    session,
    action: "create",
    resource: "payroll_run",
    resource_id: String(created._id),
    resource_label: created.run_no,
    after: { totals: built.totals, payslips: built.payslips.length },
  });
  return NextResponse.json({ success: true, data: { run: created, payslipCount: built.payslips.length, skipped: built.skipped } }, { status: 201 });
});
