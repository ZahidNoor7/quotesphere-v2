"use client";
import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { type DateRange } from "react-day-picker";
import {
  Eye, Pencil, Trash2, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown,
  SlidersHorizontal, ChevronDown, Search, FileText, Download, MessageCircle, Mail,
  CalendarIcon,
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
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PaymentStatusBadge, InvoiceStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, AC2, TOPBAR_STYLE, ICON_PILL, GLASS_BORDER } from "@/lib/ds";
import { downloadAsPdf, type DocData } from "@/lib/pdf-document";
import { TableWrapper, DataTable, Th, Td, Tr, PaginationBar } from "@/components/custom-ui";
import { SpinnerCenter } from "@/components/loaders";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import { getDesignById, getDefaultDesign } from "@/lib/document-designs";
import { useSettings } from "@/hooks/use-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Invoice } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Period = "month" | "3months" | "6months" | "year" | "custom";
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
  { value: "6months", label: "Last 6 months" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

type SortDir = "asc" | "desc";
type SortableCol = "invoice_no" | "customer_name" | "total_amount" | "issue_date";

const COLUMNS = [
  { key: "invoice_no" as const, label: "Invoice #", sortable: true },
  { key: "customer_name" as const, label: "Client", sortable: true },
  { key: "total_amount" as const, label: "Amount", sortable: true },
  { key: "status" as const, label: "Status", sortable: false },
  { key: "payment_status" as const, label: "Payment", sortable: false },
  { key: "issue_date" as const, label: "Date", sortable: true },
  { key: "source" as const, label: "Source", sortable: false },
] as const;

type ColKey = typeof COLUMNS[number]["key"];

function SortIcon({ col, sortCol, sortDir }: { col: SortableCol; sortCol: SortableCol | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={11} style={{ marginLeft: 3, opacity: 0.35 }} />;
  return sortDir === "asc"
    ? <ArrowUp size={11} style={{ marginLeft: 3, opacity: 0.75 }} />
    : <ArrowDown size={11} style={{ marginLeft: 3, opacity: 0.75 }} />;
}

export default function InvoicesPage() {
  const [searchInput, setSearchInput] = useState(""); // immediate: controls the <input>
  const [search, setSearch] = useState(""); // debounced: drives the API query
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<SortableCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
    invoice_no: true, customer_name: true, total_amount: true,
    status: true, payment_status: true, issue_date: true, source: true,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [pdfPreviewId, setPdfPreviewId] = useState<string | null>(null);
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (payStatus) params.set("payment_status", payStatus);
  {
    const now = new Date();
    if (period === "month") {
      params.set("from", format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
    } else if (period === "3months") {
      params.set("from", format(new Date(now.getFullYear(), now.getMonth() - 2, 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
    } else if (period === "6months") {
      params.set("from", format(new Date(now.getFullYear(), now.getMonth() - 5, 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
    } else if (period === "year") {
      params.set("from", format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
    } else if (period === "custom" && dateRange?.from) {
      params.set("from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"));
    }
  }

  const { data, mutate, isLoading } = useSWR(
    `/api/invoices?${params}`, fetcher, { keepPreviousData: true }
  );
  const rawInvoices: Invoice[] = data?.data ?? [];
  const pagination = data?.pagination;

  const invoices = useMemo(() => {
    if (!sortCol) return rawInvoices;
    return [...rawInvoices].sort((a, b) => {
      const av = a[sortCol as keyof Invoice];
      const bv = b[sortCol as keyof Invoice];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawInvoices, sortCol, sortDir]);

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

  const allIds = invoices.map(i => i._id);
  const allSel = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSel = !allSel && allIds.some(id => selected.has(id));
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
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    toast.success("Invoice deleted.");
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    setDeleteTarget(null);
    mutate();
  }

  async function changeStatus(id: string, newStatus: string) {
    await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success("Status updated.");
    mutate();
  }

  async function bulkDelete() {
    const ids = allIds.filter(id => selected.has(id));
    await Promise.all(ids.map(id => fetch(`/api/invoices/${id}`, { method: "DELETE" })));
    toast.success(`${ids.length} invoice(s) deleted.`);
    setSelected(new Set());
    mutate();
  }

  async function bulkStatus(st: string) {
    const ids = allIds.filter(id => selected.has(id));
    await Promise.all(ids.map(id =>
      fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: st }),
      })
    ));
    toast.success(`Updated ${ids.length} invoice(s).`);
    setSelected(new Set());
    mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>Invoices</span>
        <div style={{ marginLeft: "auto" }}>
          <Button asChild size="sm">
            <Link href="/invoices/new">+ New Invoice</Link>
          </Button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "12px 12px" : "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search
              size={13}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }}
            />
            <Input
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by # or client..."
              style={{ paddingLeft: 28, height: 32 }}
            />
          </div>

          {/* Invoice status filter */}
          <Select value={status || "_all"} onValueChange={v => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger style={{ width: 136 }}>
              <SelectValue placeholder='Select Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment status filter */}
          <Select value={payStatus || "_all"} onValueChange={v => { setPayStatus(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger style={{ width: 136 }}>
              <SelectValue placeholder='Select Payment' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All payment</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="complete">Paid</SelectItem>
            </SelectContent>
          </Select>

          {/* Date period filter */}
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v as Period);
              if (v !== "custom") {
                setDateRange(undefined);
                setPendingRange(undefined);
              }
              setPage(1);
            }}
          >
            <SelectTrigger
              className="h-auto w-auto min-w-0 rounded-full px-[10px] py-[5px] text-[11px] gap-1.5 [&>svg]:size-3 focus:ring-0 focus:ring-offset-0 focus:ring-transparent"
              style={{
                background: "var(--glass)",
                border: "0.5px solid var(--glass-border)",
                color: "var(--t2)",
                height: 32,
                minWidth: 120,
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom date range picker */}
          {period === "custom" && (
            <Popover
              open={calendarOpen}
              onOpenChange={(open) => {
                setCalendarOpen(open);
                if (open) setPendingRange(dateRange);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--glass)",
                    border: "0.5px solid var(--glass-border)",
                    borderRadius: 100,
                    padding: "5px 12px",
                    color: dateRange?.from ? "var(--t2)" : "var(--t3)",
                    fontSize: 11,
                    outline: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    height: 32,
                  }}
                >
                  <CalendarIcon size={12} style={{ opacity: 0.6 }} />
                  {dateRange?.from
                    ? dateRange.to
                      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`
                      : format(dateRange.from, "MMM d, yyyy")
                    : "Pick date range"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0" style={{ width: "auto", minWidth: 500 }} align="end">
                <Calendar
                  mode="range"
                  selected={pendingRange}
                  onSelect={setPendingRange}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                  className="[--cell-size:2rem] w-full"
                  autoFocus
                />
                <div
                  style={{
                    borderTop: "0.5px solid var(--glass-border)",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>
                    {pendingRange?.from
                      ? pendingRange.to
                        ? `${format(pendingRange.from, "MMM d")} – ${format(pendingRange.to, "MMM d, yyyy")}`
                        : `${format(pendingRange.from, "MMM d, yyyy")} – …`
                      : "Select start & end date"}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPendingRange(undefined)}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!pendingRange?.from}
                      onClick={() => {
                        setDateRange(pendingRange);
                        setPage(1);
                        setCalendarOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Column visibility toggle — desktop only */}
          {!isMobile && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 5, height: 32 }}>
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
                  <DropdownMenuItem onClick={() => bulkStatus("issued")}>Mark as Issued</DropdownMenuItem>
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
                    <AlertDialogTitle>Delete {selCount} invoice(s)?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone. All payment records will also be deleted.</AlertDialogDescription>
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

        {/* ── Table / Cards ────────────────────────────────────────────────── */}
        {isLoading ? (
          <TableWrapper style={{ flex: 1 }}><SpinnerCenter height={200} /></TableWrapper>
        ) : invoices.length === 0 ? (
          <TableWrapper style={{ flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 8 }}>
              <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="0.8">
                <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                <path d="M9 2v3h3M5 7h6M5 10h4" />
              </svg>
              <div style={{ fontSize: 13, color: "var(--t2)", fontWeight: 500 }}>No invoices found</div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>Create your first invoice to get started</div>
              <Button asChild size="sm" style={{ marginTop: 8 }}>
                <Link href="/invoices/new">+ Create invoice</Link>
              </Button>
            </div>
          </TableWrapper>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {invoices.map(inv => (
              <div
                key={inv._id}
                style={{
                  background: selected.has(inv._id) ? "var(--glass-hover)" : "var(--glass)",
                  border: `0.5px solid ${selected.has(inv._id) ? "rgba(99,102,241,0.35)" : "var(--glass-border)"}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Row 1: checkbox + invoice# + amount + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox
                    checked={selected.has(inv._id)}
                    onCheckedChange={() => toggleRow(inv._id)}
                  />
                  <Link
                    href={`/invoices/${inv._id}`}
                    style={{ flex: 1, color: AC2, fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                  >
                    {inv.invoice_no}
                  </Link>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>
                    {formatCurrency(inv.total_amount, inv.currency)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ ...ICON_PILL, width: 28, height: 28 }}>
                        <MoreVertical size={13} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" style={{ minWidth: 168 }}>
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${inv._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Eye size={13} /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPdfPreviewId(inv._id)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={13} /> Preview PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${inv._id}/edit`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Pencil size={13} /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {inv.status !== "draft" && <DropdownMenuItem onClick={() => changeStatus(inv._id, "draft")}>Draft</DropdownMenuItem>}
                          {inv.status !== "issued" && <DropdownMenuItem onClick={() => changeStatus(inv._id, "issued")}>Issued</DropdownMenuItem>}
                          {inv.status !== "cancelled" && <DropdownMenuItem onClick={() => changeStatus(inv._id, "cancelled")}>Cancelled</DropdownMenuItem>}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem style={{ color: "#f87171" }} onClick={() => setDeleteTarget(inv)}>
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Row 2: client name */}
                <div style={{ fontSize: 13, color: T1, fontWeight: 500, paddingLeft: 26 }}>
                  {inv.customer_name}
                </div>

                {/* Row 3: badges + date */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 26, flexWrap: "wrap" }}>
                  <InvoiceStatusBadge status={inv.status} />
                  <PaymentStatusBadge status={inv.payment_status} />
                  <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
                    {formatDate(inv.issue_date)}
                  </span>
                </div>

                {/* Row 4: source (conditional) */}
                {inv.converted_from && (
                  <div style={{ paddingLeft: 26 }}>
                    <Link href={`/quotations/${inv.converted_from}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                      <span style={{ fontSize: 10, color: "var(--t3)" }}>Quotation</span>
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#818cf8" strokeWidth="1.8"><path d="M2 6h8M7 3l3 3-3 3" /></svg>
                      <span style={{ fontSize: 10, color: "#818cf8", fontWeight: 500 }}>Invoiced</span>
                    </Link>
                  </div>
                )}
              </div>
            ))}
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
                  {visibleCols.invoice_no && (
                    <Th style={{ width: 105, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("invoice_no")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Invoice # <SortIcon col="invoice_no" sortCol={sortCol} sortDir={sortDir} />
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
                  {visibleCols.status && <Th style={{ width: 90 }}>Status</Th>}
                  {visibleCols.payment_status && <Th style={{ width: 90 }}>Payment</Th>}
                  {visibleCols.issue_date && (
                    <Th style={{ width: 120, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("issue_date")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Date <SortIcon col="issue_date" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.source && <Th style={{ width: 130 }}>Source</Th>}
                  <Th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <Tr
                    key={inv._id}
                    style={selected.has(inv._id) ? { background: "var(--glass-hover)" } : undefined}
                  >
                    <Td onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(inv._id)}
                        onCheckedChange={() => toggleRow(inv._id)}
                      />
                    </Td>
                    {visibleCols.invoice_no && (
                      <Td style={{ color: AC2, fontWeight: 500 }}>
                        <Link href={`/invoices/${inv._id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {inv.invoice_no}
                        </Link>
                      </Td>
                    )}
                    {visibleCols.customer_name && (
                      <Td style={{ color: T1, fontWeight: 500 }}>{inv.customer_name}</Td>
                    )}
                    {visibleCols.total_amount && (
                      <Td style={{ color: T1, fontWeight: 500 }}>
                        {formatCurrency(inv.total_amount, inv.currency)}
                      </Td>
                    )}
                    {visibleCols.status && <Td><InvoiceStatusBadge status={inv.status} /></Td>}
                    {visibleCols.payment_status && <Td><PaymentStatusBadge status={inv.payment_status} /></Td>}
                    {visibleCols.issue_date && <Td style={{ color: "var(--t3)" }}>{formatDate(inv.issue_date)}</Td>}
                    {visibleCols.source && (
                      <Td>
                        {inv.converted_from ? (
                          <Link href={`/quotations/${inv.converted_from}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                            <span style={{ fontSize: 10, color: "var(--t3)" }}>Quotation</span>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#818cf8" strokeWidth="1.8"><path d="M2 6h8M7 3l3 3-3 3" /></svg>
                            <span style={{ fontSize: 10, color: "#818cf8", fontWeight: 500 }}>Invoiced</span>
                          </Link>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--t3)" }}>—</span>
                        )}
                      </Td>
                    )}
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
                            <Link href={`/invoices/${inv._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Eye size={13} /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPdfPreviewId(inv._id)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FileText size={13} /> Preview PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/invoices/${inv._id}/edit`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Pencil size={13} /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {inv.status !== "draft" && <DropdownMenuItem onClick={() => changeStatus(inv._id, "draft")}>Draft</DropdownMenuItem>}
                              {inv.status !== "issued" && <DropdownMenuItem onClick={() => changeStatus(inv._id, "issued")}>Issued</DropdownMenuItem>}
                              {inv.status !== "cancelled" && <DropdownMenuItem onClick={() => changeStatus(inv._id, "cancelled")}>Cancelled</DropdownMenuItem>}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            style={{ color: "#f87171" }}
                            onClick={() => setDeleteTarget(inv)}
                          >
                            <Trash2 size={13} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </tbody>
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

      {/* Invoice PDF Preview dialog */}
      {pdfPreviewId && (
        <InvoicePdfPreviewDialog
          invoiceId={pdfPreviewId}
          settings={settings}
          onClose={() => setPdfPreviewId(null)}
        />
      )}

      {/* Single-row delete dialog — state-controlled to avoid nesting inside DropdownMenu */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All payment records will also be deleted.
            </AlertDialogDescription>
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

// ─── Invoice PDF Preview Sheet ────────────────────────────────────────────────
function InvoicePdfPreviewDialog({ invoiceId, settings, onClose }: { invoiceId: string; settings: any; onClose: () => void }) {
  const { data: invoice, isLoading } = useSWR<Invoice>(`/api/invoices/${invoiceId}`, (url: string) => fetch(url).then(r => r.json()).then(d => d.data));
  const isMobile = useIsMobile();
  const [downloading, setDownloading] = useState(false);

  const userDesigns = settings?.documentDesigns ?? [];
  const invoiceDesignId = invoice?.designId ?? settings?.lastUsed?.invoiceDesignId;
  const invoiceDesign = invoiceDesignId
    ? getDesignById(invoiceDesignId, userDesigns)
    : getDefaultDesign("invoice", userDesigns);

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "flex flex-col p-0 gap-0 h-[85vh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[600px] sm:max-w-[600px]"}
      >
        <SheetHeader style={{ padding: "14px 18px 10px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
          <SheetTitle>Invoice Preview</SheetTitle>
          <SheetDescription>{invoice ? `${invoice.invoice_no} · ${invoice.customer_name}` : "Loading..."}</SheetDescription>
        </SheetHeader>
        <div style={{ flex: 1, padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {isLoading || !invoice ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, width: "100%" }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div id={`invoice-print-area-${invoiceId}`}>
              <DocumentRenderer
                design={invoiceDesign}
                width={isMobile ? 320 : 580}
                data={{
                  type: "invoice",
                  docNo: invoice.invoice_no,
                  issueDate: invoice.issue_date,
                  dueDate: invoice.due_date,
                  customer: { name: invoice.customer_name, phone: invoice.customer_phone, address: invoice.customer_address },
                  items: invoice.items,
                  subTotal: invoice.sub_total,
                  taxAmt: invoice.tax_type === "percentage" ? invoice.sub_total * invoice.tax / 100 : invoice.tax,
                  taxLabel: invoice.tax_type === "percentage" ? `Tax (${invoice.tax}%)` : "Tax",
                  discount: invoice.discount,
                  delivery: invoice.delivery_charges,
                  total: invoice.total_amount,
                  advance: invoice.advance,
                  outstanding: invoice.outstanding,
                  currency: invoice.currency,
                  remarks: invoice.remarks,
                  companyName: settings?.company_name ?? "Your Company",
                  companyEmail: settings?.company_email,
                  companyPhone: settings?.company_phone,
                  companyAddress: settings?.company_address,
                  termsText: settings?.terms_and_conditions,
                }}
              />
            </div>
          )}
        </div>
        <div style={{ padding: "12px 18px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              variant="outline"
              size="sm"
              disabled={!invoice}
              style={{ display: "flex", alignItems: "center", gap: 5, color: "#25D366", borderColor: "rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.06)" }}
              onClick={() => {
                if (!invoice) return;
                const phone = invoice.customer_phone?.replace(/\D/g, "") ?? "";
                const msg = encodeURIComponent(`Hello ${invoice.customer_name},\n\nYour invoice ${invoice.invoice_no} for ${formatCurrency(invoice.total_amount, invoice.currency)} is ready.\n\nPlease let us know if you have any questions.`);
                window.open(`https://api.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${msg}`, "_blank");
              }}
            >
              <MessageCircle size={13} /> WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!invoice}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
              onClick={() => {
                if (!invoice) return;
                const subject = encodeURIComponent(`Invoice ${invoice.invoice_no}`);
                const body = encodeURIComponent(`Hello ${invoice.customer_name},\n\nPlease find your invoice ${invoice.invoice_no} for ${formatCurrency(invoice.total_amount, invoice.currency)}.\n\nThank you for your business!`);
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
              }}
            >
              <Mail size={13} /> Email
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              size="sm"
              disabled={!invoice || downloading}
              loading={downloading}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
              onClick={async () => {
                if (!invoice) return;
                setDownloading(true);
                try {
                  const data: DocData = {
                    type: "invoice",
                    docNo: invoice.invoice_no,
                    issueDate: invoice.issue_date,
                    dueDate: invoice.due_date,
                    customer: { name: invoice.customer_name, phone: invoice.customer_phone, address: invoice.customer_address },
                    items: invoice.items,
                    subTotal: invoice.sub_total,
                    taxAmt: invoice.tax_type === "percentage" ? invoice.sub_total * invoice.tax / 100 : invoice.tax,
                    taxLabel: invoice.tax_type === "percentage" ? `Tax (${invoice.tax}%)` : "Tax",
                    discount: invoice.discount,
                    delivery: invoice.delivery_charges,
                    total: invoice.total_amount,
                    advance: invoice.advance,
                    outstanding: invoice.outstanding,
                    currency: invoice.currency,
                    remarks: invoice.remarks,
                    companyName: settings?.company_name ?? "Your Company",
                    companyEmail: settings?.company_email,
                    companyPhone: settings?.company_phone,
                    companyAddress: settings?.company_address,
                    termsText: settings?.terms_and_conditions,
                  };
                  await downloadAsPdf(invoiceDesign, data, `Invoice-${invoice.invoice_no}.pdf`);
                } finally { setDownloading(false); }
              }}
            >
              <Download size={13} /> Download PDF
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
