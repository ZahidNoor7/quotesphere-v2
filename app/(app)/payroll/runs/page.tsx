"use client";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { RunStatusBadge } from "@/components/payroll/payroll-badges";

import { formatMoney } from "@/lib/payroll/money";
import { formatDate } from "@/lib/utils";
import { T1, T2, T3 } from "@/lib/ds";
import type { PayPeriod, PayrollRun } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as PayrollRun[]);
const periodFetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as PayPeriod[]);

export default function PayrollRunsPage() {
  const router = useRouter();
  const { data: runs = [], mutate, isLoading, error } = useSWR<PayrollRun[]>("/api/payroll/runs", fetcher);
  const { data: openPeriods = [] } = useSWR<PayPeriod[]>("/api/payroll/pay-periods?status=open", periodFetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodId, setPeriodId] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function createRun() {
    if (!periodId) { toast.error("Select a pay period."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payPeriodId: periodId, notes: notes || undefined }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not create run");
      const skipped = d.data?.skipped?.length ?? 0;
      toast.success(`Run created with ${d.data.payslipCount} payslip(s)${skipped ? ` · ${skipped} skipped (no structure)` : ""}.`);
      setDialogOpen(false); setPeriodId(""); setNotes("");
      mutate();
      router.push(`/payroll/runs/${d.data.run._id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create run");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-4" />New payroll run</Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div style={{ flex: 1 }}><ErrorState message="Failed to load runs." onRetry={() => mutate()} /></div>
      ) : runs.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState icon={Play} title="No payroll runs yet" description="Generate a run for an open pay period to create payslips for all active employees." action={<Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-4" />Create first run</Button>} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <Th style={{ width: 120 }}>Run #</Th>
                  <Th>Period</Th>
                  <Th style={{ width: 110 }}>Employees</Th>
                  <Th style={{ width: 160 }}>Net total</Th>
                  <Th style={{ width: 150 }}>Status</Th>
                  <Th style={{ width: 130 }}>Created</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const period = typeof r.payPeriodId === "object" ? r.payPeriodId : null;
                  return (
                    <Tr key={r._id} onClick={() => router.push(`/payroll/runs/${r._id}`)}>
                      <Td style={{ fontFamily: "monospace", fontSize: 12, color: T2 }}>{r.run_no}</Td>
                      <Td style={{ color: T1, fontWeight: 500 }}>{period?.label ?? "—"}</Td>
                      <Td style={{ color: T2 }}>{r.totals?.employeeCount ?? 0}</Td>
                      <Td style={{ color: T1, fontWeight: 500 }}>{formatMoney(r.totals?.netTotal ?? 0, r.fxRateUsed?.base ?? "PKR")}</Td>
                      <Td><RunStatusBadge status={r.status} /></Td>
                      <Td style={{ color: T3 }}>{formatDate(r.createdAt)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableWrapper>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription>Generates a draft payslip for every active employee with a salary structure, using current FX rates.</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
            <div>
              <div style={{ fontSize: 12, color: T3, marginBottom: 6 }}>Pay period</div>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger><SelectValue placeholder="Select an open period" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {openPeriods.length === 0 ? (
                      <div style={{ padding: "8px 10px", fontSize: 12, color: T3 }}>No open periods. Create one first.</div>
                    ) : openPeriods.map((p) => <SelectItem key={p._id} value={p._id}>{p.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T3, marginBottom: 6 }}>Notes (optional)</div>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. includes Eid bonus" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={createRun} loading={creating} disabled={!periodId}>Generate run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
