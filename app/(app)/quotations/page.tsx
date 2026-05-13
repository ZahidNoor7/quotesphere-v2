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
  CalendarIcon, Copy, FileSpreadsheet,
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
import { QuotationStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import { generatePdfFromElement, downloadFile } from "@/lib/pdf-export";
import type { DocData } from "@/lib/pdf-document";
import { applyPeriodParams } from "@/lib/date-utils";
import { T1, AC2, TOPBAR_STYLE, ICON_PILL, GLASS_BORDER } from "@/lib/ds";
import { TableWrapper, DataTable, Th, Td, Tr, PaginationBar } from "@/components/custom-ui";
import { TableSkeleton } from "@/components/loaders";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import { getDesignById, getDefaultDesign } from "@/lib/document-designs";
import { useSettings } from "@/hooks/use-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Quotation, Project } from "@/types";

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
type SortableCol = "quotation_no" | "customer_name" | "total_amount" | "valid_until" | "issue_date";

const COLUMNS = [
  { key: "quotation_no"   as const, label: "Quote #",     sortable: true  },
  { key: "customer_name"  as const, label: "Client",      sortable: true  },
  { key: "project"        as const, label: "Project",     sortable: false },
  { key: "total_amount"   as const, label: "Amount",      sortable: true  },
  { key: "issue_date"     as const, label: "Issue Date",  sortable: true  },
  { key: "valid_until"    as const, label: "Valid Until",  sortable: true  },
  { key: "status"         as const, label: "Status",      sortable: false },
  { key: "converted_to"   as const, label: "Converted",   sortable: false },
] as const;

type ColKey = typeof COLUMNS[number]["key"];

function SortIcon({ col, sortCol, sortDir }: { col: SortableCol; sortCol: SortableCol | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={11} style={{ marginLeft: 3, opacity: 0.35 }} />;
  return sortDir === "asc"
    ? <ArrowUp   size={11} style={{ marginLeft: 3, opacity: 0.75 }} />
    : <ArrowDown size={11} style={{ marginLeft: 3, opacity: 0.75 }} />;
}

export default function QuotationsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status,  setStatus]  = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [page,    setPage]    = useState(1);
  const [sortCol, setSortCol] = useState<SortableCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
    quotation_no: true, customer_name: true, project: true, total_amount: true,
    issue_date: true, valid_until: true, status: true, converted_to: true,
  });
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [pdfPreviewId, setPdfPreviewId] = useState<string | null>(null);
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  applyPeriodParams(params, period, dateRange);

  const { data, mutate, isLoading, error } = useSWR(
    `/api/quotations?${params}`, fetcher, { keepPreviousData: true }
  );
  const rawQuotations: Quotation[] = data?.data ?? [];
  const pagination = data?.pagination;
  const { data: projectsData = [] } = useSWR<Project[]>("/api/projects?limit=200", (url: string) => fetch(url).then(r => r.json()).then(d => d.data ?? []));
  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    (projectsData as Project[]).forEach(p => { m[p._id] = p.name; });
    return m;
  }, [projectsData]);

  const quotations = useMemo(() => {
    if (!sortCol) return rawQuotations;
    return [...rawQuotations].sort((a, b) => {
      const av = a[sortCol as keyof Quotation];
      const bv = b[sortCol as keyof Quotation];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawQuotations, sortCol, sortDir]);

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

  const allIds   = quotations.map(q => q._id);
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
    await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    toast.success("Quotation deleted.");
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
    setDeleteTarget(null);
    mutate();
  }

  async function changeStatus(id: string, newStatus: string) {
    const body: Record<string, unknown> = { status: newStatus };
    if (newStatus === "approved") body.approved_at = new Date();
    await fetch(`/api/quotations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    toast.success("Status updated.");
    mutate();
  }

  async function bulkDelete() {
    const ids = allIds.filter(id => selected.has(id));
    await Promise.all(ids.map(id => fetch(`/api/quotations/${id}`, { method: "DELETE" })));
    toast.success(`${ids.length} quotation(s) deleted.`);
    setSelected(new Set());
    mutate();
  }

  async function bulkStatus(st: string) {
    const ids = allIds.filter(id => selected.has(id));
    const body: Record<string, unknown> = { status: st };
    if (st === "approved") body.approved_at = new Date();
    await Promise.all(ids.map(id =>
      fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ));
    toast.success(`Updated ${ids.length} quotation(s).`);
    setSelected(new Set());
    mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>Quotations</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Download size={12} /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: 188 }}>
              <DropdownMenuLabel style={{ fontSize: 10.5, opacity: 0.6 }}>Quick export</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { const a = document.createElement("a"); a.href = "/api/export?module=quotations&format=csv"; a.download = "quotations.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); toast.success("Downloading quotations CSV…"); }} style={{ display: "flex", alignItems: "center", gap: 7 }}>
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
            <Link href="/quotations/new">+ New Quotation</Link>
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
              placeholder="Search quotations or clients..."
              style={{ paddingLeft: 28, height: 32 }}
            />
          </div>

          {/* Status filter */}
          <Select value={status || "_all"} onValueChange={v => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
            <SelectTrigger style={{ width: 148 }}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
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
                  <DropdownMenuItem onClick={() => bulkStatus("pending")}>Mark as Pending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkStatus("approved")}>Mark as Approved</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkStatus("rejected")}>Mark as Rejected</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkStatus("expired")}>Mark as Expired</DropdownMenuItem>
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
                    <AlertDialogTitle>Delete {selCount} quotation(s)?</AlertDialogTitle>
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

        {/* ── Table / Cards ────────────────────────────────────────────────── */}
        {isLoading ? (
          <TableWrapper style={{ flex: 1 }}><TableSkeleton cols={8} /></TableWrapper>
        ) : error ? (
          <TableWrapper style={{ flex: 1 }}><ErrorState message="Failed to load quotations." onRetry={() => mutate()} /></TableWrapper>
        ) : quotations.length === 0 ? (
          <TableWrapper style={{ flex: 1 }}>
            <EmptyState
              icon={FileText}
              title="No quotations found"
              description="Create your first quotation to get started"
              action={<Button asChild size="sm"><Link href="/quotations/new">+ Create quotation</Link></Button>}
            />
          </TableWrapper>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {quotations.map(qt => (
              <div
                key={qt._id}
                style={{
                  background: selected.has(qt._id) ? "var(--glass-hover)" : "var(--glass)",
                  border: `0.5px solid ${selected.has(qt._id) ? "rgba(99,102,241,0.35)" : "var(--glass-border)"}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Row 1: checkbox + quote# + amount + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox
                    checked={selected.has(qt._id)}
                    onCheckedChange={() => toggleRow(qt._id)}
                  />
                  <Link
                    href={`/quotations/${qt._id}`}
                    style={{ flex: 1, color: AC2, fontWeight: 600, fontSize: 13, textDecoration: "none" }}
                  >
                    {qt.quotation_no}
                  </Link>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>
                    {formatCurrency(qt.total_amount, qt.currency)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ ...ICON_PILL, width: 44, height: 44 }} aria-label="Open quotation actions">
                        <MoreVertical size={13} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" style={{ minWidth: 168 }}>
                      <DropdownMenuItem asChild>
                        <Link href={`/quotations/${qt._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Eye size={13} /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPdfPreviewId(qt._id)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={13} /> Preview PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/quotations/${qt._id}/edit`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Pencil size={13} /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/quotations/new?from=${qt._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                          <Copy size={13} /> Duplicate
                        </Link>
                      </DropdownMenuItem>
                      {qt.status === "approved" && !qt.converted_to && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/quotations/${qt._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", color: "var(--accent2)" }}>
                              <FileText size={13} /> Convert to Invoice
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {qt.status !== "draft"    && <DropdownMenuItem onClick={() => changeStatus(qt._id, "draft")}>Draft</DropdownMenuItem>}
                          {qt.status !== "pending"  && <DropdownMenuItem onClick={() => changeStatus(qt._id, "pending")}>Pending</DropdownMenuItem>}
                          {qt.status !== "approved" && <DropdownMenuItem onClick={() => changeStatus(qt._id, "approved")}>Approved</DropdownMenuItem>}
                          {qt.status !== "rejected" && <DropdownMenuItem onClick={() => changeStatus(qt._id, "rejected")}>Rejected</DropdownMenuItem>}
                          {qt.status !== "expired"  && <DropdownMenuItem onClick={() => changeStatus(qt._id, "expired")}>Expired</DropdownMenuItem>}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem style={{ color: "#f87171" }} onClick={() => setDeleteTarget(qt)}>
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Row 2: client name */}
                <div style={{ fontSize: 13, color: T1, fontWeight: 500, paddingLeft: 26 }}>
                  {qt.customer_name}
                </div>

                {/* Row 3: status badge + issue date + valid until */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 26, flexWrap: "wrap" }}>
                  <QuotationStatusBadge status={qt.status} />
                  {qt.project_id && projectMap[qt.project_id] && (
                    <Link href={`/projects/${qt.project_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 100, background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                      <span style={{ fontSize: 10, color: "#818cf8", fontWeight: 500 }}>{projectMap[qt.project_id]}</span>
                    </Link>
                  )}
                  {qt.issue_date && (
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>
                      {formatDate(qt.issue_date)}
                    </span>
                  )}
                  {qt.valid_until && (
                    <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
                      Valid until {formatDate(qt.valid_until)}
                    </span>
                  )}
                </div>

                {/* Row 4: converted badge (conditional) */}
                {qt.converted_to && (
                  <div style={{ paddingLeft: 26 }}>
                    <Link href={`/invoices/${qt.converted_to}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, background: "rgba(52,211,153,0.08)", border: "0.5px solid rgba(52,211,153,0.25)", textDecoration: "none" }}>
                      <span style={{ fontSize: 10, color: "var(--t3)" }}>Quotation</span>
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#34d399" strokeWidth="1.8"><path d="M2 6h8M7 3l3 3-3 3"/></svg>
                      <span style={{ fontSize: 10, color: "#34d399", fontWeight: 500 }}>Invoiced</span>
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
                  {visibleCols.quotation_no && (
                    <Th style={{ width: 105, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("quotation_no")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Quote # <SortIcon col="quotation_no" sortCol={sortCol} sortDir={sortDir} />
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
                  {visibleCols.project && <Th style={{ width: 130 }}>Project</Th>}
                  {visibleCols.total_amount && (
                    <Th style={{ width: 115, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("total_amount")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Amount <SortIcon col="total_amount" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.issue_date && (
                    <Th style={{ width: 120, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("issue_date")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Issue Date <SortIcon col="issue_date" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.valid_until && (
                    <Th style={{ width: 120, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("valid_until")}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        Valid Until <SortIcon col="valid_until" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </Th>
                  )}
                  {visibleCols.status && <Th style={{ width: 100 }}>Status</Th>}
                  {visibleCols.converted_to && <Th style={{ width: 130 }}>Converted</Th>}
                  <Th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {quotations.map(qt => (
                  <Tr
                    key={qt._id}
                    style={selected.has(qt._id) ? { background: "var(--glass-hover)" } : undefined}
                  >
                    <Td onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(qt._id)}
                        onCheckedChange={() => toggleRow(qt._id)}
                      />
                    </Td>
                    {visibleCols.quotation_no && (
                      <Td style={{ color: AC2, fontWeight: 500 }}>
                        <Link href={`/quotations/${qt._id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {qt.quotation_no}
                        </Link>
                      </Td>
                    )}
                    {visibleCols.customer_name && (
                      <Td style={{ color: T1, fontWeight: 500 }}>{qt.customer_name}</Td>
                    )}
                    {visibleCols.project && (
                      <Td>
                        {qt.project_id && projectMap[qt.project_id] ? (
                          <Link href={`/projects/${qt.project_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.25)", textDecoration: "none", maxWidth: 120, overflow: "hidden" }}>
                            <span style={{ fontSize: 10, color: "#818cf8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{projectMap[qt.project_id]}</span>
                          </Link>
                        ) : <span style={{ fontSize: 10, color: "var(--t3)" }}>—</span>}
                      </Td>
                    )}
                    {visibleCols.total_amount && (
                      <Td style={{ color: T1, fontWeight: 500 }}>
                        {formatCurrency(qt.total_amount, qt.currency)}
                      </Td>
                    )}
                    {visibleCols.issue_date && (
                      <Td style={{ color: "var(--t3)" }}>
                        {qt.issue_date ? formatDate(qt.issue_date) : "—"}
                      </Td>
                    )}
                    {visibleCols.valid_until && (
                      <Td style={{ color: "var(--t3)" }}>
                        {qt.valid_until ? formatDate(qt.valid_until) : "—"}
                      </Td>
                    )}
                    {visibleCols.status && <Td><QuotationStatusBadge status={qt.status} /></Td>}
                    {visibleCols.converted_to && (
                      <Td>
                        {qt.converted_to ? (
                          <Link href={`/invoices/${qt.converted_to}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 100, background: "rgba(52,211,153,0.08)", border: "0.5px solid rgba(52,211,153,0.25)", textDecoration: "none" }}>
                            <span style={{ fontSize: 10, color: "var(--t3)" }}>Quotation</span>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#34d399" strokeWidth="1.8"><path d="M2 6h8M7 3l3 3-3 3"/></svg>
                            <span style={{ fontSize: 10, color: "#34d399", fontWeight: 500 }}>Invoiced</span>
                          </Link>
                        ) : (
                          <span style={{ fontSize: 10, color: "var(--t3)" }}>—</span>
                        )}
                      </Td>
                    )}

                    {/* Row actions dropdown */}
                    <Td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            style={{ ...ICON_PILL, width: 28, height: 28 }}
                            onClick={e => e.stopPropagation()}
                            aria-label="Open quotation actions"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ minWidth: 168 }}>
                          <DropdownMenuItem asChild>
                            <Link href={`/quotations/${qt._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Eye size={13} /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPdfPreviewId(qt._id)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FileText size={13} /> Preview PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/quotations/${qt._id}/edit`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Pencil size={13} /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/quotations/new?from=${qt._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                              <Copy size={13} /> Duplicate
                            </Link>
                          </DropdownMenuItem>
                          {qt.status === "approved" && !qt.converted_to && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/quotations/${qt._id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", color: "var(--accent2)" }}>
                                  <FileText size={13} /> Convert to Invoice
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {qt.status !== "draft"     && <DropdownMenuItem onClick={() => changeStatus(qt._id, "draft")}>Draft</DropdownMenuItem>}
                              {qt.status !== "pending"   && <DropdownMenuItem onClick={() => changeStatus(qt._id, "pending")}>Pending</DropdownMenuItem>}
                              {qt.status !== "approved"  && <DropdownMenuItem onClick={() => changeStatus(qt._id, "approved")}>Approved</DropdownMenuItem>}
                              {qt.status !== "rejected"  && <DropdownMenuItem onClick={() => changeStatus(qt._id, "rejected")}>Rejected</DropdownMenuItem>}
                              {qt.status !== "expired"   && <DropdownMenuItem onClick={() => changeStatus(qt._id, "expired")}>Expired</DropdownMenuItem>}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            style={{ color: "#f87171" }}
                            onClick={() => setDeleteTarget(qt)}
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

      {/* Quotation PDF Preview dialog */}
      {pdfPreviewId && (
        <QuotationPdfPreviewDialog
          quotationId={pdfPreviewId}
          settings={settings}
          onClose={() => setPdfPreviewId(null)}
        />
      )}

      {/* Single-row delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.quotation_no}?</AlertDialogTitle>
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

// ─── Quotation PDF Preview Sheet ──────────────────────────────────────────────
function QuotationPdfPreviewDialog({ quotationId, settings, onClose }: { quotationId: string; settings: any; onClose: () => void }) {
  const { data: quotation, isLoading } = useSWR<Quotation>(`/api/quotations/${quotationId}`, (url: string) => fetch(url).then(r => r.json()).then(d => d.data));
  const [sharing, setSharing] = useState<"whatsapp" | "email" | "download" | null>(null);
  const isMobile = useIsMobile();

  const userDesigns = settings?.documentDesigns ?? [];
  const quotationDesignId = quotation?.designId ?? settings?.lastUsed?.quotationDesignId;
  const quotationDesign = quotationDesignId
    ? getDesignById(quotationDesignId, userDesigns)
    : getDefaultDesign("quotation", userDesigns);

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "flex flex-col p-0 gap-0 h-[85vh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[600px] sm:max-w-[600px]"}
      >
        <SheetHeader style={{ padding: "14px 18px 10px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
          <SheetTitle>Quotation Preview</SheetTitle>
          <SheetDescription>{quotation ? `${quotation.quotation_no} · ${quotation.customer_name}` : "Loading..."}</SheetDescription>
        </SheetHeader>
        <div style={{ flex: 1, padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {isLoading || !quotation ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200, width: "100%" }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div id={`quotation-print-area-${quotationId}`}>
              <DocumentRenderer
                design={quotationDesign}
                width={isMobile ? 320 : 580}
                data={{
                  type: "quotation",
                  docNo: quotation.quotation_no,
                  issueDate: quotation.issue_date,
                  dueDate: quotation.valid_until,
                  customer: { name: quotation.customer_name, phone: quotation.customer_phone, address: quotation.customer_address },
                  items: quotation.items,
                  subTotal: quotation.sub_total,
                  taxAmt: quotation.tax_type === "percentage" ? quotation.sub_total * quotation.tax / 100 : quotation.tax,
                  taxLabel: quotation.tax_type === "percentage" ? `Tax (${quotation.tax}%)` : "Tax",
                  discount: quotation.discount,
                  delivery: quotation.delivery_charges,
                  total: quotation.total_amount,
                  currency: quotation.currency,
                  remarks: quotation.remarks,
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
              disabled={!quotation}
              loading={sharing === "whatsapp"}
              style={{ display: "flex", alignItems: "center", gap: 5, color: "#25D366", borderColor: "rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.06)" }}
              onClick={async () => {
                if (!quotation) return;
                setSharing("whatsapp");
                try {
                  const file = await generatePdfFromElement(`quotation-print-area-${quotationId}`, `Quotation-${quotation.quotation_no}.pdf`);
                  const phone = quotation.customer_phone?.replace(/\D/g, "") ?? "";
                  const message = `Hello ${quotation.customer_name},\n\nYour quotation ${quotation.quotation_no} for ${formatCurrency(quotation.total_amount, quotation.currency)} is ready.\n\nPlease let us know if you have any questions.`;
                  if (file && navigator.canShare?.({ files: [file] })) {
                    try { await navigator.share({ files: [file], text: message }); } catch (e: any) { if (e?.name !== "AbortError") throw e; }
                  } else {
                    if (file) downloadFile(file);
                    const msg = encodeURIComponent(message);
                    window.open(`https://api.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${msg}`, "_blank");
                    if (file) toast.info("PDF downloaded — attach it in WhatsApp.");
                  }
                } finally { setSharing(null); }
              }}
            >
              <MessageCircle size={13} /> WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!quotation}
              loading={sharing === "email"}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
              onClick={async () => {
                if (!quotation) return;
                setSharing("email");
                try {
                  const file = await generatePdfFromElement(`quotation-print-area-${quotationId}`, `Quotation-${quotation.quotation_no}.pdf`);
                  const subject = encodeURIComponent(`Quotation ${quotation.quotation_no}`);
                  const body = encodeURIComponent(`Hello ${quotation.customer_name},\n\nPlease find your quotation ${quotation.quotation_no} for ${formatCurrency(quotation.total_amount, quotation.currency)} attached.\n\nThank you!`);
                  if (file) downloadFile(file);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  if (file) toast.info("PDF downloaded — attach it to your email.");
                } finally { setSharing(null); }
              }}
            >
              <Mail size={13} /> Email
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              size="sm"
              disabled={!quotation || !!sharing}
              loading={sharing === "download"}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
              onClick={async () => {
                if (!quotation) return;
                setSharing("download");
                try {
                  const data: DocData = {
                    type: "quotation",
                    docNo: quotation.quotation_no,
                    issueDate: quotation.issue_date,
                    dueDate: quotation.valid_until,
                    customer: { name: quotation.customer_name, phone: quotation.customer_phone, address: quotation.customer_address },
                    items: quotation.items,
                    subTotal: quotation.sub_total,
                    taxAmt: quotation.tax_type === "percentage" ? quotation.sub_total * quotation.tax / 100 : quotation.tax,
                    taxLabel: quotation.tax_type === "percentage" ? `Tax (${quotation.tax}%)` : "Tax",
                    discount: quotation.discount,
                    delivery: quotation.delivery_charges,
                    total: quotation.total_amount,
                    currency: quotation.currency,
                    remarks: quotation.remarks,
                    companyName: settings?.company_name ?? "Your Company",
                    companyEmail: settings?.company_email,
                    companyPhone: settings?.company_phone,
                    companyAddress: settings?.company_address,
                    termsText: settings?.terms_and_conditions,
                  };
                  const { downloadAsPdf } = await import("@/lib/pdf-document");
                  await downloadAsPdf(quotationDesign, data, `Quotation-${quotation.quotation_no}.pdf`);
                } finally { setSharing(null); }
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
