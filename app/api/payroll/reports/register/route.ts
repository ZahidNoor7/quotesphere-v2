import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import PayrollRun from "@/models/PayrollRun";
import Payslip from "@/models/Payslip";

// Payroll register for a period: the live (non-cancelled) run, its payslips and totals.
export const GET = withTenant("GET /api/payroll/reports/register", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const periodId = new URL(req.url).searchParams.get("periodId") || "";
  if (!isValidObjectId(periodId)) return NextResponse.json({ success: false, error: "Invalid period id" }, { status: 400 });

  const run = await PayrollRun.findOne({ payPeriodId: periodId, status: { $ne: "cancelled" } })
    .populate("payPeriodId", "label startDate endDate payDate status")
    .lean();
  if (!run) return NextResponse.json({ success: true, data: { run: null, payslips: [], totals: null } });

  const payslips = await Payslip.find({ payrollRunId: run._id }).sort({ "employeeSnapshot.name": 1 }).lean();
  return NextResponse.json({ success: true, data: { run, payslips, totals: run.totals } });
});
