import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { fromMinor } from "@/lib/payroll/money";
import PayrollRun, { type IPayrollRun } from "@/models/PayrollRun";
import Payslip from "@/models/Payslip";

/** Quote a CSV field (wrap + double any embedded quotes) to neutralize commas/quotes. */
function csv(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

// bank-transfer.csv for a run: one row per payslip with the net to disburse.
export const GET = withTenant("GET /api/payroll/reports/bank-transfer", async (req: NextRequest, _ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const runId = new URL(req.url).searchParams.get("runId") || "";
  if (!isValidObjectId(runId)) return NextResponse.json({ success: false, error: "Invalid run id" }, { status: 400 });

  const run = (await PayrollRun.findById(runId).lean()) as IPayrollRun | null;
  if (!run) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const payslips = await Payslip.find({ payrollRunId: runId }).sort({ "employeeSnapshot.name": 1 }).lean();

  const header = ["Employee Code", "Employee Name", "Bank", "Account Title", "Account Number", "IBAN", "Net Pay", "Currency"];
  const rows = payslips.map((p) => {
    const e = p.employeeSnapshot;
    return [e.employee_code, e.name, e.bankName, e.accountTitle, e.accountNumber, e.iban, fromMinor(p.net).toFixed(2), p.payCurrency].map(csv).join(",");
  });
  const body = [header.map(csv).join(","), ...rows].join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bank-transfer-${run.run_no}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
