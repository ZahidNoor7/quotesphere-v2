"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import Link from "next/link";
import {
  Download, FileText, FileSpreadsheet, Users, Receipt,
  FileBarChart, BarChart3, TrendingUp, ChevronRight, X,
  AlertTriangle, LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Customer } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

const THIS_YEAR = new Date().getFullYear();
const PRESETS = [
  { label: "This month", from: new Date(THIS_YEAR, new Date().getMonth(), 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
  { label: "Q1", from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-03-31` },
  { label: "Q2", from: `${THIS_YEAR}-04-01`, to: `${THIS_YEAR}-06-30` },
  { label: "Q3", from: `${THIS_YEAR}-07-01`, to: `${THIS_YEAR}-09-30` },
  { label: "Q4", from: `${THIS_YEAR}-10-01`, to: `${THIS_YEAR}-12-31` },
  { label: `FY ${THIS_YEAR}`, from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-12-31` },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function triggerDownload(url: string, filename?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function buildExportUrl(params: Record<string, string>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  return `/api/export?${p}`;
}

// ─── DateRange row ────────────────────────────────────────────────────────────
function DateRangeRow({
  from, to, onFromChange, onToChange, onClear, label = "Date range",
}: {
  from: string; to: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
  onClear: () => void; label?: string;
}) {
  const hasValue = from || to;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--glass)", borderRadius: 8, border: "0.5px solid var(--glass-border)" }}>
      <span style={{ fontSize: 11.5, color: T3, fontWeight: 500, flexShrink: 0, minWidth: 72 }}>{label}</span>
      <DatePickerInput value={from} onChange={onFromChange} placeholder="From" />
      <span style={{ color: T3, fontSize: 12, flexShrink: 0 }}>—</span>
      <DatePickerInput value={to} onChange={onToChange} placeholder="To" />
      {hasValue ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear date range"
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: T3, background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 4, transition: "color 0.15s", flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = T1)}
          onMouseLeave={e => (e.currentTarget.style.color = T3)}
        >
          <X size={11} /> Clear
        </button>
      ) : (
        <span style={{ fontSize: 11, color: T3, marginLeft: "auto", flexShrink: 0 }}>All time</span>
      )}
    </div>
  );
}

// ─── Preset pill buttons ──────────────────────────────────────────────────────
function PresetPills({
  activeFrom, activeTo, onChange,
}: {
  activeFrom: string; activeTo: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Date range presets">
      {PRESETS.map(({ label, from, to }) => {
        const isActive = activeFrom === from && activeTo === to;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(from, to)}
            aria-pressed={isActive}
            style={{
              padding: "6px 12px", borderRadius: 100, fontSize: 11.5, cursor: "pointer",
              minHeight: 32, transition: "all 0.15s",
              background: isActive ? "rgba(99,102,241,0.2)" : "var(--glass)",
              color: isActive ? AC2 : T3,
              border: `0.5px solid ${isActive ? "rgba(99,102,241,0.4)" : "var(--glass-border)"}`,
              fontWeight: isActive ? 600 : 400,
            }}
            onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--glass-hover)"; (e.currentTarget as HTMLElement).style.color = T2; } }}
            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--glass)"; (e.currentTarget as HTMLElement).style.color = T3; } }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Export module row ────────────────────────────────────────────────────────
interface ExportRowProps {
  label: string; sub?: string; icon: React.ReactNode; accentColor: string;
  onCsv: () => void; isLast?: boolean;
}
function ExportRow({ label, sub, icon, accentColor, onCsv, isLast }: ExportRowProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 10px",
        borderBottom: isLast ? "none" : "0.5px solid var(--glass-border)",
        borderRadius: isLast ? "0 0 6px 6px" : 0,
        background: hover ? "var(--glass-hover)" : "transparent",
        transition: "background 0.15s",
        cursor: "default",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Module icon */}
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accentColor}18`, border: `0.5px solid ${accentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{sub}</div>}
      </div>
      {/* Actions */}
      <Button
        variant="outline"
        size="sm"
        onClick={onCsv}
        aria-label={`Download ${label} as CSV`}
        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, height: 30 }}
      >
        <Download size={11} /> CSV
      </Button>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ icon, title, description, badge, children }: {
  icon: React.ReactNode; title: string; description: string;
  badge?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 14px", borderBottom: "0.5px solid var(--glass-border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 4px rgba(99,102,241,0.06)" }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{title}</span>
            {badge && (
              <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 100, background: "rgba(99,102,241,0.14)", color: AC2, border: "0.5px solid rgba(99,102,241,0.22)", letterSpacing: "0.04em" }}>
                {badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: T3, lineHeight: 1.5 }}>{description}</div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "16px 20px" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Client search picker ─────────────────────────────────────────────────────
function ClientPicker({ customers, value, onChange }: {
  customers: Customer[]; value: string; onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = customers.find(c => c._id === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 30);

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 200 }} ref={ref}>
      {selected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.25)", borderRadius: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {selected.name[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
            {selected.company && <div style={{ fontSize: 10.5, color: T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.company}</div>}
          </div>
          <button
            type="button"
            onClick={() => { onChange(""); setSearch(""); }}
            aria-label="Clear selected client"
            style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 2, display: "flex", flexShrink: 0, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = T1)}
            onMouseLeave={e => (e.currentTarget.style.color = T3)}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T3 }} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="M11 11l3 3" /></svg>
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search clients…"
            style={{ paddingLeft: 28, height: 34 }}
            aria-label="Search and select client"
          />
        </div>
      )}
      {open && !selected && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "var(--glass-surface-bg)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8, backdropFilter: "blur(24px)", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxHeight: 220, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: T3 }}>No clients match "{search}"</div>
          ) : filtered.map(c => (
            <button
              key={c._id}
              type="button"
              onClick={() => { onChange(c._id); setSearch(""); setOpen(false); }}
              style={{ width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 1, borderBottom: `0.5px solid var(--glass-border)` }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 12.5, color: T1, fontWeight: 500 }}>{c.name}</span>
              {(c.company || c.phone_no) && <span style={{ fontSize: 11, color: T3 }}>{[c.company, c.phone_no].filter(Boolean).join(" · ")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { settings } = useSettings();
  const currency = settings?.default_currency ?? "PKR";
  const isMobile = useIsMobile();

  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const [stmtCustomerId, setStmtCustomerId] = useState("");
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");
  const [stmtLoading, setStmtLoading] = useState(false);

  const { data: customers = [] } = useSWR<Customer[]>("/api/customers?limit=500", fetcher);

  const csvDownload = useCallback((module: string) => {
    const filename = `${module}-export.csv`;
    triggerDownload(buildExportUrl({ module, format: "csv", from: exportFrom, to: exportTo }), filename);
    toast.success(`Downloading ${module} CSV…`);
  }, [exportFrom, exportTo]);

  const excelDownload = useCallback(() => {
    const rangeStr = exportFrom && exportTo ? `_${exportFrom}_to_${exportTo}` : "";
    triggerDownload(buildExportUrl({ format: "xlsx", from: exportFrom, to: exportTo }), `quotesphere-export${rangeStr}.xlsx`);
    toast.success("Excel workbook download started…");
  }, [exportFrom, exportTo]);

  async function generateFinancialReport() {
    setReportLoading(true);
    try {
      const [invRes, expRes] = await Promise.all([
        fetch(buildExportUrl({ format: "json", module: "invoices", from: reportFrom, to: reportTo })).then(r => r.json()),
        fetch(buildExportUrl({ format: "json", module: "expenses", from: reportFrom, to: reportTo })).then(r => r.json()),
      ]);
      if (!invRes.success || !expRes.success) throw new Error("Failed to fetch report data");
      const { downloadFinancialReport } = await import("@/lib/report-pdf");
      const rangeStr = reportFrom && reportTo ? `_${reportFrom}_to_${reportTo}` : "";
      await downloadFinancialReport({
        invoices: invRes.data.invoices ?? [],
        expenses: expRes.data.expenses ?? [],
        settings: settings ?? null,
        from: reportFrom || undefined,
        to: reportTo || undefined,
        currency,
      }, `financial-report${rangeStr}.pdf`);
      toast.success("Financial report PDF ready.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  }

  async function generateClientStatement() {
    if (!stmtCustomerId) { toast.error("Please select a client first."); return; }
    setStmtLoading(true);
    try {
      const res = await fetch(buildExportUrl({ format: "json", customer_id: stmtCustomerId, from: stmtFrom, to: stmtTo })).then(r => r.json());
      if (!res.success) throw new Error(res.error ?? "Fetch failed");
      const { downloadClientStatement } = await import("@/lib/report-pdf");
      await downloadClientStatement({
        customer: res.data.customer,
        invoices: res.data.invoices ?? [],
        quotations: res.data.quotations ?? [],
        expenses: res.data.expenses ?? [],
        settings: settings ?? null,
        from: stmtFrom || undefined,
        to: stmtTo || undefined,
        currency,
      });
      toast.success("Client statement PDF ready.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate statement.");
    } finally {
      setStmtLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={15} style={{ color: AC2, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Reports & Export</span>
          </div>
          <span style={{ fontSize: 11.5, color: T3, paddingLeft: 23 }}>
            CSV, Excel workbooks, and PDF reports for accounting & tax filing
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "20px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: isMobile ? 12 : 18, alignContent: "start" }}>

        {/* ── LEFT: Data Export ───────────────────────────────────── */}
        <SectionCard
          icon={<FileSpreadsheet size={17} style={{ color: AC2 }} />}
          title="Data Export"
          badge="CSV · Excel"
          description="Download records by module as CSV, or get all data in one multi-sheet Excel workbook."
        >
          <DateRangeRow
            label="Date filter"
            from={exportFrom} to={exportTo}
            onFromChange={setExportFrom} onToChange={setExportTo}
            onClear={() => { setExportFrom(""); setExportTo(""); }}
          />

          <div style={{ marginTop: 14, borderRadius: 8, border: "0.5px solid var(--glass-border)", overflow: "hidden" }}>
            <ExportRow
              label="Invoices"
              sub="Invoice #, client, amounts, payment status"
              icon={<FileText size={13} style={{ color: AC2 }} />}
              accentColor="#6366f1"
              onCsv={() => csvDownload("invoices")}
            />
            <ExportRow
              label="Quotations"
              sub="Quotation #, client, amounts, approval status"
              icon={<FileText size={13} style={{ color: "#818cf8" }} />}
              accentColor="#818cf8"
              onCsv={() => csvDownload("quotations")}
            />
            <ExportRow
              label="Expenses"
              sub="Expense #, vendor, client, amounts, categories"
              icon={<Receipt size={13} style={{ color: "#f59e0b" }} />}
              accentColor="#f59e0b"
              onCsv={() => csvDownload("expenses")}
            />
            <ExportRow
              label="Clients"
              sub="Name, company, contact, currency, status"
              icon={<Users size={13} style={{ color: "#34d399" }} />}
              accentColor="#34d399"
              onCsv={() => csvDownload("customers")}
              isLast
            />
          </div>

          {/* Excel workbook CTA */}
          <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(5,150,105,0.07)", border: "0.5px solid rgba(5,150,105,0.22)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(5,150,105,0.14)", border: "0.5px solid rgba(5,150,105,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileSpreadsheet size={17} style={{ color: "#34d399" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 2 }}>Full Excel Workbook</div>
              <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.4 }}>
                5 sheets: Summary, Invoices, Quotations, Expenses, Clients
              </div>
            </div>
            <Button
              onClick={excelDownload}
              aria-label="Download full Excel workbook"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(5,150,105,0.15)", color: "#34d399", border: "0.5px solid rgba(5,150,105,0.35)", flexShrink: 0, transition: "all 0.15s" }}
              onMouseEnter={(e) => Object.assign((e.currentTarget as HTMLElement).style, { background: "rgba(5,150,105,0.25)" })}
              onMouseLeave={(e) => Object.assign((e.currentTarget as HTMLElement).style, { background: "rgba(5,150,105,0.15)" })}
            >
              <Download size={13} /> .xlsx
            </Button>
          </div>
        </SectionCard>

        {/* ── RIGHT: PDF Reports ──────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 18 }}>

          {/* Financial Report */}
          <SectionCard
            icon={<TrendingUp size={17} style={{ color: AC2 }} />}
            title="Financial Report"
            badge="PDF"
            description="Revenue, collections, outstanding, and expense summary for any period."
          >
            <PresetPills activeFrom={reportFrom} activeTo={reportTo} onChange={(f, t) => { setReportFrom(f); setReportTo(t); }} />
            <div style={{ marginTop: 10 }}>
              <DateRangeRow
                from={reportFrom} to={reportTo}
                onFromChange={setReportFrom} onToChange={setReportTo}
                onClear={() => { setReportFrom(""); setReportTo(""); }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <Button
                loading={reportLoading}
                onClick={generateFinancialReport}
                aria-label="Generate financial report PDF"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <FileBarChart size={13} />
                {reportLoading ? "Generating…" : "Generate PDF"}
              </Button>
            </div>
          </SectionCard>

          {/* Client Statement */}
          <SectionCard
            icon={<FileText size={17} style={{ color: AC2 }} />}
            title="Client Statement"
            badge="PDF"
            description="Per-client account summary with all invoices, quotations, and payments."
          >
            <ClientPicker
              customers={customers as Customer[]}
              value={stmtCustomerId}
              onChange={setStmtCustomerId}
            />

            {stmtCustomerId ? (
              <div style={{ marginTop: 10 }}>
                <DateRangeRow
                  label="Period"
                  from={stmtFrom} to={stmtTo}
                  onFromChange={setStmtFrom} onToChange={setStmtTo}
                  onClear={() => { setStmtFrom(""); setStmtTo(""); }}
                />
              </div>
            ) : (
              <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--glass)", border: "0.5px dashed var(--glass-border)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T3 }}>Search and select a client above to generate their account statement.</div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <Button
                loading={stmtLoading}
                onClick={generateClientStatement}
                disabled={!stmtCustomerId}
                aria-label="Generate client statement PDF"
                style={{ display: "flex", alignItems: "center", gap: 6, opacity: stmtCustomerId ? 1 : 0.5 }}
              >
                <FileText size={13} />
                {stmtLoading ? "Generating…" : "Generate PDF"}
              </Button>
            </div>
          </SectionCard>

          {/* Analytics Reports */}
          <SectionCard
            icon={<LineChart size={17} style={{ color: AC2 }} />}
            title="Analytics Reports"
            description="Interactive financial reports with charts and drill-down detail."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  href: "/reports/profit-loss",
                  icon: <TrendingUp size={14} style={{ color: "#34d399" }} />,
                  color: "#34d399",
                  label: "Profit & Loss",
                  sub: "Revenue vs. expenses, gross margin, monthly breakdown",
                },
                {
                  href: "/reports/aging",
                  icon: <AlertTriangle size={14} style={{ color: "#f87171" }} />,
                  color: "#f87171",
                  label: "Aging Receivables",
                  sub: "Overdue invoices bucketed by 30 / 60 / 90+ days",
                },
              ].map(({ href, icon, color, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--glass-hover)"; (e.currentTarget as HTMLElement).style.borderColor = `${color}44`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--glass)"; (e.currentTarget as HTMLElement).style.borderColor = GLASS_BORDER; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `0.5px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: T3 }}>{sub}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: T3, flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
