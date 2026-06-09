"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Download, FileBarChart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { RunStatusBadge } from "@/components/payroll/payroll-badges";

import { formatMoney } from "@/lib/payroll/money";
import { CARD, T1, T2, T3 } from "@/lib/ds";
import type { PayPeriod, PayrollRun, Payslip } from "@/types";

const periodFetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as PayPeriod[]);
const registerFetcher = (url: string) =>
  fetch(url).then((r) => r.json()).then((d) => d.data as { run: PayrollRun | null; payslips: Payslip[]; totals: PayrollRun["totals"] | null });

export default function PayrollReportsPage() {
  const { data: periods = [] } = useSWR<PayPeriod[]>("/api/payroll/pay-periods", periodFetcher);
  const [periodId, setPeriodId] = useState("");

  useEffect(() => {
    if (!periodId && periods.length) setPeriodId(periods[0]._id);
  }, [periods, periodId]);

  const { data, isLoading } = useSWR(periodId ? `/api/payroll/reports/register?periodId=${periodId}` : null, registerFetcher);
  const run = data?.run ?? null;
  const slips = data?.payslips ?? [];
  const base = run?.fxRateUsed?.base ?? "PKR";

  return (
    <div style={{ padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: T2 }}>Pay period</div>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger style={{ minWidth: 200 }}><SelectValue placeholder="Select a period" /></SelectTrigger>
          <SelectContent><SelectGroup>
            {periods.map((p) => <SelectItem key={p._id} value={p._id}>{p.label}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
        {run && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <RunStatusBadge status={run.status} />
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/payroll/reports/bank-transfer?runId=${run._id}`}><Download className="size-4" />Bank transfer CSV</a>
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !run ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState icon={FileBarChart} title="No run for this period" description="Generate a payroll run for the selected period to see its register." />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {[
              { label: "Run", value: run.run_no },
              { label: "Employees", value: String(run.totals?.employeeCount ?? 0) },
              { label: "Gross", value: formatMoney(run.totals?.grossTotal ?? 0, base) },
              { label: "Deductions", value: formatMoney(run.totals?.deductionsTotal ?? 0, base) },
              { label: "Net", value: formatMoney(run.totals?.netTotal ?? 0, base) },
            ].map((s) => (
              <div key={s.label} style={{ ...CARD, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: T3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <Th style={{ width: 110 }}>Code</Th>
                  <Th>Employee</Th>
                  <Th style={{ width: 130 }}>Gross</Th>
                  <Th style={{ width: 130 }}>Deductions</Th>
                  <Th style={{ width: 130 }}>Net</Th>
                  <Th style={{ width: 80 }}>Currency</Th>
                </tr>
              </thead>
              <tbody>
                {slips.map((p) => (
                  <Tr key={p._id} style={{ cursor: "default" }}>
                    <Td style={{ fontFamily: "monospace", fontSize: 12, color: T2 }}>{p.employeeSnapshot.employee_code}</Td>
                    <Td style={{ color: T1, fontWeight: 500 }}>{p.employeeSnapshot.name}</Td>
                    <Td style={{ color: T2 }}>{formatMoney(p.gross, p.payCurrency)}</Td>
                    <Td style={{ color: T2 }}>{formatMoney(p.totalDeductions, p.payCurrency)}</Td>
                    <Td style={{ color: T1, fontWeight: 500 }}>{formatMoney(p.net, p.payCurrency)}</Td>
                    <Td style={{ color: T3 }}>{p.payCurrency}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        </div>
      )}
    </div>
  );
}
