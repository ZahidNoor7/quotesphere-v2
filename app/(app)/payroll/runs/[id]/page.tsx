"use client";
import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, Send, Check, BadgeCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { ErrorState } from "@/components/shared/error-state";
import { RunStatusBadge, PayslipStatusBadge } from "@/components/payroll/payroll-badges";

import { formatMoney } from "@/lib/payroll/money";
import { formatDate } from "@/lib/utils";
import { CARD, T1, T2, T3, GLASS_BORDER } from "@/lib/ds";
import type { PayrollRun, Payslip, PayPeriod } from "@/types";

const runFetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as PayrollRun);
const slipsFetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as Payslip[]);

async function downloadPayslip(id: string, code: string) {
  try {
    const res = await fetch(`/api/pdf/payslip/${id}`);
    const ct = res.headers.get("content-type") ?? "";
    let blob: Blob;
    if (ct.includes("application/json")) {
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error(d.error ?? "Could not generate payslip");
      blob = await (await fetch(d.url)).blob();
    } else {
      if (!res.ok) throw new Error("Could not generate payslip");
      blob = await res.blob();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payslip-${code}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not download payslip");
  }
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: run, mutate, isLoading, error } = useSWR<PayrollRun>(`/api/payroll/runs/${id}`, runFetcher);
  const { data: slips = [], mutate: mutateSlips } = useSWR<Payslip[]>(`/api/payroll/runs/${id}/payslips`, slipsFetcher);
  const [busy, setBusy] = useState(false);

  const period = run && typeof run.payPeriodId === "object" ? (run.payPeriodId as PayPeriod) : null;
  const base = run?.fxRateUsed?.base ?? "PKR";

  async function action(path: string, msg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${id}/${path}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Action failed");
      toast.success(msg);
      mutate(); mutateSlips();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRun() {
    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/runs/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not cancel run");
      toast.success("Run cancelled.");
      mutate(); mutateSlips();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel run");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }
  if (error || !run) {
    return <div style={{ padding: 20, height: "100%" }}><ErrorState message="Failed to load this run." onRetry={() => mutate()} /></div>;
  }

  const totals = run.totals;
  const canCancel = run.status !== "paid" && run.status !== "cancelled";

  return (
    <div style={{ padding: "18px 20px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Button variant="outline" size="sm" onClick={() => router.push("/payroll/runs")}><ArrowLeft className="size-4" />Runs</Button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T1, fontFamily: "monospace" }}>{run.run_no}</div>
          <RunStatusBadge status={run.status} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(run.status === "approved" || run.status === "paid") && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/payroll/reports/bank-transfer?runId=${id}`}><Download className="size-4" />Bank transfer CSV</a>
            </Button>
          )}
          {run.status === "draft" && <Button size="sm" disabled={busy} onClick={() => action("submit", "Submitted for approval.")}><Send className="size-4" />Submit for approval</Button>}
          {run.status === "pending_approval" && <Button size="sm" disabled={busy} onClick={() => action("approve", "Run approved.")} style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}><Check className="size-4" />Approve</Button>}
          {run.status === "approved" && <Button size="sm" disabled={busy} onClick={() => action("mark-paid", "Run marked as paid.")} style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}><BadgeCheck className="size-4" />Mark as paid</Button>}
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={busy}><X className="size-4" />Cancel</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
                  <AlertDialogDescription style={{ color: T2 }}>Cancelling deletes the draft payslips and reopens the period. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep run</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelRun}>Cancel run</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {[
          { label: "Period", value: period?.label ?? "—" },
          { label: "Employees", value: String(totals?.employeeCount ?? 0) },
          { label: "Gross total", value: formatMoney(totals?.grossTotal ?? 0, base) },
          { label: "Deductions", value: formatMoney(totals?.deductionsTotal ?? 0, base) },
          { label: "Net total", value: formatMoney(totals?.netTotal ?? 0, base) },
          { label: "Employer cost", value: formatMoney(totals?.employerCostTotal ?? 0, base) },
        ].map((s) => (
          <div key={s.label} style={{ ...CARD, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: T3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: T3 }}>
        Pay date {period ? formatDate(period.payDate) : "—"} · Base currency {base}
        {run.notes ? ` · ${run.notes}` : ""}
      </div>

      {/* Payslips */}
      <TableWrapper>
        <DataTable>
          <thead>
            <tr>
              <Th style={{ width: 110 }}>Code</Th>
              <Th>Employee</Th>
              <Th style={{ width: 130 }}>Gross</Th>
              <Th style={{ width: 130 }}>Deductions</Th>
              <Th style={{ width: 130 }}>Net</Th>
              <Th style={{ width: 90 }}>Status</Th>
              <Th style={{ width: 90, textAlign: "right" }}>Payslip</Th>
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
                <Td><PayslipStatusBadge status={p.paymentStatus} /></Td>
                <Td style={{ textAlign: "right" }}>
                  <Button variant="outline" size="sm" onClick={() => downloadPayslip(p._id, p.employeeSnapshot.employee_code)}><FileText className="size-3.5" />PDF</Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </TableWrapper>

      {slips.length === 0 && <div style={{ fontSize: 13, color: T3, padding: 8, border: `0.5px dashed ${GLASS_BORDER}`, borderRadius: 10, textAlign: "center" }}>No payslips on this run.</div>}

      <div style={{ fontSize: 12, color: T3 }}>
        Need a payslip view? <Link href="/payroll/reports" style={{ color: "var(--accent2)" }}>Open the payroll register →</Link>
      </div>
    </div>
  );
}
