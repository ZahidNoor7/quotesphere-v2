"use client";
import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import {
  Eye, Pencil, Trash2, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown,
  SlidersHorizontal, ChevronDown, Search, Receipt, Download, FileText, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
  Input,
} from "@/components/ui/input";
import { ExpenseStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T3, AC2, TOPBAR_STYLE, ICON_PILL, TOOLBAR_CONTROL } from "@/lib/ds";
import { TableWrapper, DataTable, Th, Td, Tr, PaginationBar } from "@/components/custom-ui";
import { TableSkeleton } from "@/components/loaders";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Expense } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SortDir = "asc" | "desc";
type SortableCol = "expense_no" | "bill_date" | "vendor_name" | "customer_name" | "total_amount";

const COLUMNS = [
  { key: "expense_no"    as const, label: "Expense #", sortable: true  },
  { key: "bill_date"     as const, label: "Date",       sortable: true  },
  { key: "vendor_name"   as const, label: "Vendor",     sortable: true  },
  { key: "customer_name" as const, label: "Client",     sortable: true  },
  { key: "total_amount"  as const, label: "Amount",     sortable: true  },
  { key: "status"        as const, label: "Status",     sortable: false },
] as const;

type ColKey = typeof COLUMNS[number]["key"];

function SortIcon({ col, sortCol, sortDir }: { col: SortableCol; sortCol: SortableCol | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={11} style={{ marginLeft: 3, opacity: 0.35 }} />;
  return sortDir === "asc"
    ? <ArrowUp   size={11} style={{ marginLeft: 3, opacity: 0.75 }} />
    : <ArrowDown size={11} style={{ marginLeft: 3, opacity: 0.75 }} />;
}

export default function ExpensesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status,  setStatus]  = useState("");
  const [page,    setPage]    = useState(1);
  const [sortCol, setSortCol] = useState<SortableCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
    expense_no: true, bill_date: true, vendor_name: true,
    customer_name: true, total_amount: true, status: true,
  });
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const isMobile = useIsMobile();

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const { data, mutate, isLoading, error } = useSWR(
    `/api/expenses?${params}`, fetcher, { keepPreviousData: true }
  );
  const rawExpenses: Expense[] = data?.data ?? [];
  const pagination = data?.pagination;

  const expenses = useMemo(() => {
    if (!sortCol) return rawExpenses;
    return [...rawExpenses].sort((a, b) => {
      const av = a[sortCol as keyof Expense];
      const bv = b[sortCol as keyof Expense];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawExpenses, sortCol, sortDir]);

  const pageTotal = expenses.reduce((s, e) => s + e.total_amount, 0);

  function toggleSort(col: SortableCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function handleSearch(v: string) {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 350);
  }

  const allIds   = expenses.map(e => e._id);
  const allSel   = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSel  = !allSel && allIds.some(id => selected.has(id));
  const selCount = allIds.filter(id => selected.has(id)).length;

  function toggleAll() {
    setSelected(prev => {
      const s = new Set(prev);
      if (allSel) allIds.forEach(id => s.delete(id));
      else allIds.forEach(id => s.add(id));
      return s;
    });
  }
  function toggleRow(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function del(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    toast.success("Expense deleted.");
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    setDeleteTarget(null);
    mutate();
  }

  async function changeStatus(id: string, newStatus: string) {
    await fetch(`/api/expenses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success("Status updated.");
    mutate();
  }

  async function bulkDelete() {
    const ids = allIds.filter(id => selected.has(id));
    await Promise.all(ids.map(id => fetch(`/api/expenses/${id}`, { method: "DELETE" })));
    toast.success(`${ids.length} expense(s) deleted.`);
    setSelected(new Set());
    mutate();
  }

  async function bulkStatus(st: string) {
    const ids = allIds.filter(id => selected.has(id));
    await Promise.all(ids.map(id =>
      fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: st }),
      })
    ));
    toast.success(`Updated ${ids.length} expense(s).`);
    setSelected(new Set());
    mutate();
  }

  // count of data cols before Amount, for tfoot colspan
  const visDataCols =
    (visibleCols.expense_no    ? 1 : 0) +
    (visibleCols.bill_date     ? 1 : 0) +
    (visibleCols.vendor_name   ? 1 : 0) +
    (visibleCols.customer_name ? 1 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>Expenses</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Download size={12} /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: 188 }}>
              <DropdownMenuLabel style={{ fontSize: 10.5, opacity: 0.6 }}>Quick export</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { const a = document.createElement("a"); a.href = "/api/export?module=expenses&format=csv"; a.download = "expenses.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); toast.success("Downloading expenses CSV…"); }} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <FileText size={12} /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/reports" style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                  <FileSpreadsheet size={12} /> Reports & Excel →
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild size="sm">
            <Link href="/expenses/new">+ Add expense</Link>
          </Button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "12px 12px" : "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search
              size={13}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }}
            />
            <Input
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search expenses, vendors..."
              style={{ paddingLeft: 28, ...TOOLBAR_CONTROL }}
            />
          </div>

          <Select value={status || "_all"} onValueChange={v => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger style={{ width: 148, ...TOOLBAR_CONTROL }}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="recorded">Recorded</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Column visibility — desktop only */}
          {!isMobile && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 5, ...TOOLBAR_CONTROL }}>
                <SlidersHorizontal size={13} /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: 160 }}>
              <DropdownMenuLabel style={{ fontSize: 11, opacity: 0.7 }}>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleCols[col.key]}
                  onCheckedChange={v => setVisibleCols(p => ({ ...p, [col.key]: !!v }))}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>

        {/* ── Bulk actions bar ─────────────────────────────────────────────── */}
        {selCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            background: "var(--glass)", border: "0.5px solid var(--glass-border)",
            borderRadius: 10, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, color: T1, fontWeight: 500 }}>{selCount} selected</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                    Change Status <ChevronDown size={11} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => bulkStatus("draft")}>Mark as Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkStatus("recorded")}>Mark as Recorded</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkStatus("verified")}>Mark as Verified</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkStatus("cancelled")}>Mark as Cancelled</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    style={{ background: "#ef4444", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                  >
                    <Trash2 size={12} /> Delete ({selCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selCount} expense(s)?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={bulkDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="ghost" size="sm" style={{ fontSize: 12 }} onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* ── Table / Cards ───────────────────────────────────────────────── */}
        {isLoading ? (
          <TableWrapper style={{ flex: 1 }}><TableSkeleton cols={6} /></TableWrapper>
        ) : error ? (
          <TableWrapper style={{ flex: 1 }}><ErrorState message="Failed to load expenses." onRetry={() => mutate()} /></TableWrapper>
        ) : expenses.length === 0 ? (
          <TableWrapper style={{ flex: 1 }}>
            <EmptyState
              icon={Receipt}
              title="No expenses recorded"
              description="Record your first expense to start tracking costs"
              action={<Button asChild size="sm"><Link href="/expenses/new">+ Record expense</Link></Button>}
            />
          </TableWrapper>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {expenses.map(exp => (
              <div
                key={exp._id}
                style={{
                  background: selected.has(exp._id) ? "var(--glass-hover)" : "var(--glass)",
                  border: `0.5px solid ${selected.has(exp._id) ? "rgba(99,102,241,0.35)" : "var(--glass-border)"}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Row 1: checkbox + expense# + amount + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox
                    checked={selected.has(exp._id)}
                    onCheckedChange={() => toggleRow(exp._id)}
                  />
                  <Link
                    href={`/expenses/${exp._id}`}
                    style={{ flex: 1, color: AC2, fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                  >
                    {exp.expense_no}
                  </Link>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>
                    {formatCurrency(exp.total_amount, exp.currency)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ ...ICON_PILL, width: 28, height: 28 }}>
                        <MoreVertical size={13} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" style={{ minWidth: 168 }}>
                      <DropdownMenuItem asChild>
                        <Link href={`/expenses/${exp._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Eye size={13} /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/expenses/${exp._id}/edit`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Pencil size={13} /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {exp.status !== "draft"     && <DropdownMenuItem onClick={() => changeStatus(exp._id, "draft")}>Draft</DropdownMenuItem>}
                          {exp.status !== "recorded"  && <DropdownMenuItem onClick={() => changeStatus(exp._id, "recorded")}>Recorded</DropdownMenuItem>}
                          {exp.status !== "verified"  && <DropdownMenuItem onClick={() => changeStatus(exp._id, "verified")}>Verified</DropdownMenuItem>}
                          {exp.status !== "cancelled" && <DropdownMenuItem onClick={() => changeStatus(exp._id, "cancelled")}>Cancelled</DropdownMenuItem>}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        style={{ color: "#f87171" }}
                        onClick={() => setDeleteTarget(exp)}
                      >
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Row 2: vendor + client */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 26, flexWrap: "wrap" }}>
                  {exp.vendor_name && (
                    <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 500 }}>{exp.vendor_name}</span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--t2)" }}>{exp.customer_name}</span>
                </div>

                {/* Row 3: status badge + date */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 26, flexWrap: "wrap" }}>
                  <ExpenseStatusBadge status={exp.status} />
                  <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
                    {formatDate(exp.bill_date)}
                  </span>
                </div>
              </div>
            ))}

            {/* Page total */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", fontSize: 12, color: T3 }}>
              <span>Page total</span>
              <span style={{ fontWeight: 600, color: T1 }}>{formatCurrency(pageTotal)}</span>
            </div>
          </div>
        ) : (
          /* ── Desktop table ── */
          <TableWrapper style={{ flex: 1, overflowY: "auto" }}>
            <DataTable>
              <thead>
                <tr>
                  <Th style={{ width: 40 }}>
                    <Checkbox
                      checked={someSel ? "indeterminate" : allSel}
                      onCheckedChange={toggleAll}
                    />
                  </Th>
                  {visibleCols.expense_no && (
                    <Th style={{ width: 110, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("expense_no")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Expense # <SortIcon col="expense_no" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.bill_date && (
                    <Th style={{ width: 90, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("bill_date")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Date <SortIcon col="bill_date" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.vendor_name && (
                    <Th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("vendor_name")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Vendor <SortIcon col="vendor_name" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.customer_name && (
                    <Th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("customer_name")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Client <SortIcon col="customer_name" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.total_amount && (
                    <Th style={{ width: 115, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("total_amount")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Amount <SortIcon col="total_amount" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.status && <Th style={{ width: 95 }}>Status</Th>}
                  <Th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <Tr
                    key={exp._id}
                    style={selected.has(exp._id) ? { background: "var(--glass-hover)" } : undefined}
                  >
                    <Td onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(exp._id)}
                        onCheckedChange={() => toggleRow(exp._id)}
                      />
                    </Td>
                    {visibleCols.expense_no && (
                      <Td style={{ color: AC2, fontWeight: 500 }}>
                        <Link href={`/expenses/${exp._id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {exp.expense_no}
                        </Link>
                      </Td>
                    )}
                    {visibleCols.bill_date     && <Td style={{ color: "var(--t3)" }}>{formatDate(exp.bill_date)}</Td>}
                    {visibleCols.vendor_name   && <Td>{exp.vendor_name || "—"}</Td>}
                    {visibleCols.customer_name && <Td style={{ color: T1, fontWeight: 500 }}>{exp.customer_name}</Td>}
                    {visibleCols.total_amount  && <Td style={{ color: T1, fontWeight: 500 }}>{formatCurrency(exp.total_amount, exp.currency)}</Td>}
                    {visibleCols.status        && <Td><ExpenseStatusBadge status={exp.status} /></Td>}

                    <Td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            style={{ ...ICON_PILL, width: 28, height: 28 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreVertical size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ minWidth: 168 }}>
                          <DropdownMenuItem asChild>
                            <Link href={`/expenses/${exp._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Eye size={13} /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/expenses/${exp._id}/edit`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Pencil size={13} /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {exp.status !== "draft"     && <DropdownMenuItem onClick={() => changeStatus(exp._id, "draft")}>Draft</DropdownMenuItem>}
                              {exp.status !== "recorded"  && <DropdownMenuItem onClick={() => changeStatus(exp._id, "recorded")}>Recorded</DropdownMenuItem>}
                              {exp.status !== "verified"  && <DropdownMenuItem onClick={() => changeStatus(exp._id, "verified")}>Verified</DropdownMenuItem>}
                              {exp.status !== "cancelled" && <DropdownMenuItem onClick={() => changeStatus(exp._id, "cancelled")}>Cancelled</DropdownMenuItem>}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            style={{ color: "#f87171" }}
                            onClick={() => setDeleteTarget(exp)}
                          >
                            <Trash2 size={13} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </tbody>
              {/* Page total footer */}
              <tfoot>
                <tr style={{ background: "var(--glass)" }}>
                  <td
                    colSpan={1 + visDataCols}
                    style={{ padding: "8px 12px", fontSize: 11, color: T3, fontWeight: 500 }}
                  >
                    Page total
                  </td>
                  {visibleCols.total_amount && (
                    <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: T1 }}>
                      {formatCurrency(pageTotal)}
                    </td>
                  )}
                  {visibleCols.status && <td />}
                  <td />
                </tr>
              </tfoot>
            </DataTable>
          </TableWrapper>
        )}

        <PaginationBar
          page={page}
          pagination={pagination}
          onPrev={() => setPage(p => p - 1)}
          onNext={() => setPage(p => p + 1)}
        />
      </div>

      {/* Single-row delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.expense_no}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && del(deleteTarget._id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
