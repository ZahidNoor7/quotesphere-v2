"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { SearchFilterBar, FilterSelect, SelectItem } from "@/components/custom-ui/search-filter-bar";
import { PaginationBar } from "@/components/custom-ui/pagination-bar";
import { IconAction } from "@/components/custom-ui/icon-action";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/card";
import { EmployeeSheet } from "@/components/payroll/employee-sheet";

import { T1, T2, T3 } from "@/lib/ds";
import type { Employee, SalaryStructure } from "@/types";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());
const listFetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as SalaryStructure[]);

export default function PayrollEmployeesPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [edit, setEdit] = useState<Employee | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debounced) params.set("search", debounced);
  if (status !== "all") params.set("status", status);

  const { data, mutate, isLoading, error } = useSWR(`/api/payroll/employees?${params}`, jsonFetcher, { keepPreviousData: true });
  const { data: structures = [] } = useSWR<SalaryStructure[]>("/api/payroll/salary-structures", listFetcher);
  const employees: Employee[] = data?.data ?? [];
  const structureName = (id?: string) => structures.find((s) => s._id === id)?.name;

  async function del(id: string) {
    try {
      const res = await fetch(`/api/payroll/employees/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not delete employee");
      toast.success("Employee deleted.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete employee");
    }
  }

  function openNew() { setEdit(null); setSheetOpen(true); }
  function openEdit(e: Employee) { setEdit(e); setSheetOpen(true); }

  return (
    <div style={{ padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <SearchFilterBar search={search} onSearch={setSearch} searchPlaceholder="Search by name, code, or email…">
        <FilterSelect value={status} onValueChange={(v) => { setStatus(v); setPage(1); }} placeholder="Status">
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="all">All statuses</SelectItem>
        </FilterSelect>
        <Button size="sm" onClick={openNew}><Plus className="size-4" />Add employee</Button>
      </SearchFilterBar>

      {isLoading && !data ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div style={{ flex: 1 }}><ErrorState message="Failed to load employees." onRetry={() => mutate()} /></div>
      ) : employees.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <EmptyState icon={Users} title="No employees yet" description="Add team members to run payroll for. Assign each a salary structure." action={<Button size="sm" onClick={openNew}><Plus className="size-4" />Add first employee</Button>} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <Th style={{ width: 110 }}>Code</Th>
                  <Th>Name</Th>
                  <Th style={{ width: 150 }}>Department</Th>
                  <Th style={{ width: 110 }}>Type</Th>
                  <Th style={{ width: 150 }}>Structure</Th>
                  <Th style={{ width: 90 }}>Pay</Th>
                  <Th style={{ width: 90 }}>Status</Th>
                  <Th style={{ width: 80, textAlign: "right" }}>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <Tr key={e._id} onClick={() => openEdit(e)}>
                    <Td style={{ fontFamily: "monospace", fontSize: 12, color: T2 }}>{e.employee_code}</Td>
                    <Td style={{ color: T1, fontWeight: 500 }}>
                      {e.name}
                      {e.designation && <span style={{ color: T3, fontWeight: 400 }}> · {e.designation}</span>}
                    </Td>
                    <Td style={{ color: T2 }}>{e.department || "—"}</Td>
                    <Td style={{ color: T2 }}>{e.employmentType === "contract" ? "Contract" : "Full time"}</Td>
                    <Td style={{ color: structureName(e.salaryStructureId) ? T2 : T3 }}>{structureName(e.salaryStructureId) ?? "Unassigned"}</Td>
                    <Td style={{ color: T2 }}>{e.payCurrency}</Td>
                    <Td><Badge variant={e.status === "active" ? "success" : "muted"}>{e.status === "active" ? "Active" : "Inactive"}</Badge></Td>
                    <Td onClick={(ev) => ev.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <IconAction tooltip="Edit" onClick={() => openEdit(e)}><Pencil className="size-3.5" /></IconAction>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><IconAction variant="danger" tooltip="Delete"><Trash2 className="size-3.5" /></IconAction></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete employee?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: T2 }}>&ldquo;{e.name}&rdquo; will be permanently removed. Employees with payslips can&rsquo;t be deleted — set them inactive instead.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del(e._id)}>Delete</AlertDialogAction>
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
          <PaginationBar page={page} pagination={data?.pagination} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
        </div>
      )}

      <EmployeeSheet open={sheetOpen} onOpenChange={setSheetOpen} employee={edit} structures={structures} onSaved={() => mutate()} />
    </div>
  );
}
