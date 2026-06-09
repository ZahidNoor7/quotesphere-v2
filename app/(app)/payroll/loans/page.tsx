"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { FilterSelect, SelectItem } from "@/components/custom-ui/search-filter-bar";
import { IconAction } from "@/components/custom-ui/icon-action";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoanSheet } from "@/components/payroll/loan-sheet";

import { formatMoney } from "@/lib/payroll/money";
import { T1, T2 } from "@/lib/ds";
import type { Employee, LoanAdvance } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as LoanAdvance[]);
const empFetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as Employee[]);

export default function LoansPage() {
  const [status, setStatus] = useState("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [edit, setEdit] = useState<LoanAdvance | null>(null);

  const key = `/api/payroll/loans${status !== "all" ? `?status=${status}` : ""}`;
  const { data: loans = [], mutate, isLoading, error } = useSWR<LoanAdvance[]>(key, fetcher);
  const { data: employees = [] } = useSWR<Employee[]>("/api/payroll/employees?limit=200", empFetcher);
  const empName = useMemo(() => new Map(employees.map((e) => [e._id, e])), [employees]);

  async function del(id: string) {
    try {
      const res = await fetch(`/api/payroll/loans/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not delete loan");
      toast.success("Loan deleted.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete loan");
    }
  }
  function openNew() { setEdit(null); setSheetOpen(true); }
  function openEdit(l: LoanAdvance) { setEdit(l); setSheetOpen(true); }

  return (
    <div style={{ padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <FilterSelect value={status} onValueChange={setStatus} placeholder="Status">
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </FilterSelect>
        <Button size="sm" onClick={openNew}><Plus className="size-4" />Add loan</Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div style={{ flex: 1 }}><ErrorState message="Failed to load loans." onRetry={() => mutate()} /></div>
      ) : loans.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState icon={HandCoins} title="No loans or advances" description="Track salary loans and advances; installments are auto-deducted from payslips." action={<Button size="sm" onClick={openNew}><Plus className="size-4" />Add first loan</Button>} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th style={{ width: 100 }}>Type</Th>
                  <Th style={{ width: 130 }}>Principal</Th>
                  <Th style={{ width: 130 }}>Installment</Th>
                  <Th style={{ width: 130 }}>Remaining</Th>
                  <Th style={{ width: 90 }}>Status</Th>
                  <Th style={{ width: 80, textAlign: "right" }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => {
                  const e = empName.get(l.employeeId);
                  return (
                    <Tr key={l._id} onClick={() => openEdit(l)}>
                      <Td style={{ color: T1, fontWeight: 500 }}>{e ? e.name : "—"}</Td>
                      <Td style={{ color: T2, textTransform: "capitalize" }}>{l.type}</Td>
                      <Td style={{ color: T2 }}>{formatMoney(l.principal, l.currency)}</Td>
                      <Td style={{ color: T2 }}>{formatMoney(l.installmentAmount, l.currency)}</Td>
                      <Td style={{ color: T2 }}>{formatMoney(l.remainingBalance, l.currency)}</Td>
                      <Td><Badge variant={l.status === "active" ? "info" : "muted"}>{l.status === "active" ? "Active" : "Closed"}</Badge></Td>
                      <Td onClick={(ev) => ev.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <IconAction tooltip="Edit" onClick={() => openEdit(l)}><Pencil className="size-3.5" /></IconAction>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><IconAction variant="danger" tooltip="Delete"><Trash2 className="size-3.5" /></IconAction></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete loan?</AlertDialogTitle>
                                <AlertDialogDescription style={{ color: T2 }}>This loan/advance record will be permanently removed.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del(l._id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableWrapper>
        </div>
      )}

      <LoanSheet open={sheetOpen} onOpenChange={setSheetOpen} loan={edit} employees={employees} onSaved={() => mutate()} />
    </div>
  );
}
