"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { IconAction } from "@/components/custom-ui/icon-action";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SalaryStructureSheet } from "@/components/payroll/salary-structure-sheet";

import { formatMoney } from "@/lib/payroll/money";
import { T1, T2, T3 } from "@/lib/ds";
import type { SalaryStructure } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as SalaryStructure[]);

function basicAmount(s: SalaryStructure) {
  const b = s.components.find((c) => c.isBasic);
  return b ? formatMoney(b.value, s.currency) : "—";
}

export default function SalaryStructuresPage() {
  const { data: structures = [], mutate, isLoading, error } = useSWR<SalaryStructure[]>("/api/payroll/salary-structures", fetcher);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [edit, setEdit] = useState<SalaryStructure | null>(null);

  async function del(id: string) {
    try {
      const res = await fetch(`/api/payroll/salary-structures/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not delete structure");
      toast.success("Structure deleted.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete structure");
    }
  }
  function openNew() { setEdit(null); setSheetOpen(true); }
  function openEdit(s: SalaryStructure) { setEdit(s); setSheetOpen(true); }

  return (
    <div style={{ padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="sm" onClick={openNew}><Plus className="size-4" />New structure</Button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div style={{ flex: 1 }}><ErrorState message="Failed to load structures." onRetry={() => mutate()} /></div>
      ) : structures.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState icon={Layers} title="No salary structures" description="Create reusable earning & deduction templates, then assign them to employees." action={<Button size="sm" onClick={openNew}><Plus className="size-4" />Create first structure</Button>} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th style={{ width: 110 }}>Earnings</Th>
                  <Th style={{ width: 110 }}>Deductions</Th>
                  <Th style={{ width: 150 }}>Basic</Th>
                  <Th style={{ width: 90 }}>Status</Th>
                  <Th style={{ width: 80, textAlign: "right" }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {structures.map((s) => {
                  const earnings = s.components.filter((c) => c.type === "earning").length;
                  const deductions = s.components.filter((c) => c.type === "deduction").length;
                  return (
                    <Tr key={s._id} onClick={() => openEdit(s)}>
                      <Td style={{ color: T1, fontWeight: 500 }}>{s.name}</Td>
                      <Td style={{ color: T2 }}>{earnings}</Td>
                      <Td style={{ color: T2 }}>{deductions}</Td>
                      <Td style={{ color: T2 }}>{basicAmount(s)}</Td>
                      <Td><Badge variant={s.active ? "success" : "muted"}>{s.active ? "Active" : "Inactive"}</Badge></Td>
                      <Td onClick={(ev) => ev.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <IconAction tooltip="Edit" onClick={() => openEdit(s)}><Pencil className="size-3.5" /></IconAction>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><IconAction variant="danger" tooltip="Delete"><Trash2 className="size-3.5" /></IconAction></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete structure?</AlertDialogTitle>
                                <AlertDialogDescription style={{ color: T2 }}>&ldquo;{s.name}&rdquo; will be removed. Structures assigned to employees can&rsquo;t be deleted.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del(s._id)}>Delete</AlertDialogAction>
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

      <SalaryStructureSheet open={sheetOpen} onOpenChange={setSheetOpen} structure={edit} onSaved={() => mutate()} />
    </div>
  );
}
