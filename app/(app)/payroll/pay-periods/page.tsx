"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { IconAction } from "@/components/custom-ui/icon-action";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PayPeriodSheet } from "@/components/payroll/pay-period-sheet";
import { PeriodStatusBadge } from "@/components/payroll/payroll-badges";

import { formatDate } from "@/lib/utils";
import { T1, T2 } from "@/lib/ds";
import type { PayPeriod } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as PayPeriod[]);

export default function PayPeriodsPage() {
  const { data: periods = [], mutate, isLoading, error } = useSWR<PayPeriod[]>("/api/payroll/pay-periods", fetcher);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [edit, setEdit] = useState<PayPeriod | null>(null);

  async function del(id: string) {
    try {
      const res = await fetch(`/api/payroll/pay-periods/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not delete period");
      toast.success("Period deleted.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete period");
    }
  }
  function openNew() { setEdit(null); setSheetOpen(true); }
  function openEdit(p: PayPeriod) { setEdit(p); setSheetOpen(true); }

  return (
    <div style={{ padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="sm" onClick={openNew}><Plus className="size-4" />New period</Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div style={{ flex: 1 }}><ErrorState message="Failed to load periods." onRetry={() => mutate()} /></div>
      ) : periods.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState icon={CalendarRange} title="No pay periods" description="Open a pay period (e.g. a month) before generating a payroll run for it." action={<Button size="sm" onClick={openNew}><Plus className="size-4" />Create first period</Button>} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <Th>Label</Th>
                  <Th style={{ width: 140 }}>Start</Th>
                  <Th style={{ width: 140 }}>End</Th>
                  <Th style={{ width: 140 }}>Pay date</Th>
                  <Th style={{ width: 120 }}>Status</Th>
                  <Th style={{ width: 80, textAlign: "right" }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <Tr key={p._id} onClick={() => openEdit(p)}>
                    <Td style={{ color: T1, fontWeight: 500 }}>{p.label}</Td>
                    <Td style={{ color: T2 }}>{formatDate(p.startDate)}</Td>
                    <Td style={{ color: T2 }}>{formatDate(p.endDate)}</Td>
                    <Td style={{ color: T2 }}>{formatDate(p.payDate)}</Td>
                    <Td><PeriodStatusBadge status={p.status} /></Td>
                    <Td onClick={(ev) => ev.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <IconAction tooltip="Edit" onClick={() => openEdit(p)}><Pencil className="size-3.5" /></IconAction>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><IconAction variant="danger" tooltip="Delete"><Trash2 className="size-3.5" /></IconAction></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete period?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: T2 }}>&ldquo;{p.label}&rdquo; will be removed. Periods with a payroll run can&rsquo;t be deleted.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del(p._id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        </div>
      )}

      <PayPeriodSheet open={sheetOpen} onOpenChange={setSheetOpen} period={edit} onSaved={() => mutate()} />
    </div>
  );
}
