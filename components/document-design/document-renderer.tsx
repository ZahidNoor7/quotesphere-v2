"use client";
import { resolveConfig } from "@/lib/document-designs";
import type { DocumentDesign } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface DocumentData {
  type: "invoice" | "quotation" | "receipt";
  docNo?: string;
  issueDate?: string;
  dueDate?: string;
  customer?: { name?: string; phone?: string; address?: string; company?: string };
  items?: Array<{ name: string; quantity: number; price: number }>;
  subTotal?: number;
  taxAmt?: number;
  taxLabel?: string;
  discount?: number;
  delivery?: number;
  total?: number;
  advance?: number;
  outstanding?: number;
  currency?: string;
  remarks?: string;
  // Company info
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string;
  termsText?: string;
  // Receipt-specific
  paymentDate?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  paymentRef?: string;
  remainingBalance?: number;
  invoiceNo?: string;
}

interface Props {
  design: DocumentDesign;
  data: DocumentData;
  /** Width of the rendered document in px. Default: 595 (A4). */
  width?: number;
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "INVOICE",
  quotation: "QUOTATION",
  receipt: "RECEIPT",
};

export function DocumentRenderer({ design, data, width = 595 }: Props) {
  const cfg = resolveConfig(design);
  const preset = cfg.preset ?? "modern-gradient";
  const currency = data.currency ?? "PKR";
  const fmt = (n?: number) => formatCurrency(n ?? 0, currency);
  const fmtDate = (d?: string) => d ? formatDate(new Date(d)) : "—";

  const typeLabel = TYPE_LABELS[data.type] ?? "DOCUMENT";
  const docNo = data.docNo ?? "—";
  const companyName = data.companyName ?? "Your Company";

  const scale = width / 595;
  const naturalHeight = data.type === "receipt" ? 420 : 800;

  return (
    <div style={{ width, height: naturalHeight * scale, overflow: "hidden", position: "relative" }}>
      <div style={{
        width: 595,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        fontFamily: cfg.fontFamily,
      }}>
        {preset === "classic-corporate" && (
          <ClassicDoc cfg={cfg} data={data} typeLabel={typeLabel} docNo={docNo} companyName={companyName} fmt={fmt} fmtDate={fmtDate} />
        )}
        {preset === "modern-gradient" && (
          <ModernGradientDoc cfg={cfg} data={data} typeLabel={typeLabel} docNo={docNo} companyName={companyName} fmt={fmt} fmtDate={fmtDate} />
        )}
        {preset === "minimal-clean" && (
          <MinimalDoc cfg={cfg} data={data} typeLabel={typeLabel} docNo={docNo} companyName={companyName} fmt={fmt} fmtDate={fmtDate} />
        )}
        {preset === "executive-dark" && (
          <ExecutiveDarkDoc cfg={cfg} data={data} typeLabel={typeLabel} docNo={docNo} companyName={companyName} fmt={fmt} fmtDate={fmtDate} />
        )}
        {preset === "bold-accent" && (
          <BoldAccentDoc cfg={cfg} data={data} typeLabel={typeLabel} docNo={docNo} companyName={companyName} fmt={fmt} fmtDate={fmtDate} />
        )}
        {preset === "retro-serif" && (
          <RetroSerifDoc cfg={cfg} data={data} typeLabel={typeLabel} docNo={docNo} companyName={companyName} fmt={fmt} fmtDate={fmtDate} />
        )}
        {/* Watermark */}
        {cfg.watermark && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%) rotate(-35deg)",
            fontSize: 72, fontWeight: 800, opacity: 0.06,
            color: "#000", pointerEvents: "none", whiteSpace: "nowrap",
            zIndex: 10, userSelect: "none",
          }}>{cfg.watermark}</div>
        )}
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ItemsTable({ items, cfg, fmt }: {
  items: DocumentData["items"];
  cfg: ReturnType<typeof resolveConfig>;
  fmt: (n?: number) => string;
}) {
  const accentColor = cfg.accentColor ?? "#6366f1";
  const tableStyle = cfg.tableStyle ?? "striped";
  const displayItems = (items ?? []).filter(i => i.name);

  const thStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: tableStyle === "minimal" ? `1px solid ${accentColor}30` : `2px solid ${accentColor}40`,
    color: tableStyle === "bordered" ? "#fff" : accentColor,
    background: tableStyle === "bordered" ? accentColor : tableStyle === "striped" ? `${accentColor}12` : "transparent",
    textAlign: "left" as const,
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
          <th style={{ ...thStyle, textAlign: "right", width: 40 }}>Qty</th>
          <th style={{ ...thStyle, textAlign: "right", width: 80 }}>Rate</th>
          <th style={{ ...thStyle, textAlign: "right", width: 80 }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {displayItems.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ padding: "12px 10px", textAlign: "center", color: "#999", fontSize: 8.5 }}>
              Add line items to see them here
            </td>
          </tr>
        ) : displayItems.map((item, idx) => {
          let rowBg = "transparent";
          if (tableStyle === "striped") rowBg = idx % 2 === 1 ? `${accentColor}08` : "transparent";
          const cellBorder = tableStyle === "bordered" ? `0.5px solid ${accentColor}30` : tableStyle === "striped" ? "0.5px solid rgba(0,0,0,0.05)" : "none";
          return (
            <tr key={idx} style={{ background: rowBg }}>
              <td style={{ padding: "6px 10px", borderBottom: cellBorder, borderRight: tableStyle === "bordered" ? cellBorder : "none", color: "#222", fontSize: 9 }}>{item.name}</td>
              <td style={{ padding: "6px 10px", borderBottom: cellBorder, borderRight: tableStyle === "bordered" ? cellBorder : "none", color: "#555", textAlign: "right", fontSize: 9 }}>{item.quantity}</td>
              <td style={{ padding: "6px 10px", borderBottom: cellBorder, borderRight: tableStyle === "bordered" ? cellBorder : "none", color: "#555", textAlign: "right", fontSize: 9 }}>{item.price.toLocaleString()}</td>
              <td style={{ padding: "6px 10px", borderBottom: cellBorder, color: "#111", textAlign: "right", fontWeight: 600, fontSize: 9 }}>{(item.quantity * item.price).toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TotalsBlock({ data, cfg, fmt }: {
  data: DocumentData;
  cfg: ReturnType<typeof resolveConfig>;
  fmt: (n?: number) => string;
}) {
  const accentColor = cfg.accentColor ?? "#6366f1";
  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#555", marginBottom: 3 };
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" }}>
      <div style={{ minWidth: 160 }}>
        {cfg.showTax && data.taxAmt !== undefined && data.taxAmt > 0 && (
          <div style={rowStyle}><span>{data.taxLabel ?? "Tax"}</span><span>{fmt(data.taxAmt)}</span></div>
        )}
        {cfg.showDiscount && data.discount !== undefined && data.discount > 0 && (
          <div style={rowStyle}><span>Discount</span><span style={{ color: "#16a34a" }}>-{fmt(data.discount)}</span></div>
        )}
        {data.delivery !== undefined && data.delivery > 0 && (
          <div style={rowStyle}><span>Delivery</span><span>{fmt(data.delivery)}</span></div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#111", borderTop: `1.5px solid ${accentColor}`, paddingTop: 6, marginTop: 4 }}>
          <span>Total</span>
          <span style={{ color: accentColor }}>{fmt(data.total)}</span>
        </div>
        {data.type === "invoice" && data.advance !== undefined && data.advance > 0 && (
          <div style={{ ...rowStyle, marginTop: 4, color: "#16a34a" }}><span>Advance paid</span><span>{fmt(data.advance)}</span></div>
        )}
        {data.type === "invoice" && data.outstanding !== undefined && data.outstanding > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 600, color: "#dc2626", marginTop: 2 }}><span>Outstanding</span><span>{fmt(data.outstanding)}</span></div>
        )}
      </div>
    </div>
  );
}

function ReceiptBody({ data, cfg, fmt, fmtDate }: {
  data: DocumentData;
  cfg: ReturnType<typeof resolveConfig>;
  fmt: (n?: number) => string;
  fmtDate: (d?: string) => string;
}) {
  const accentColor = cfg.accentColor ?? "#6366f1";
  const row = (label: string, value: string, accent?: boolean) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 16px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 9 }}>
      <span style={{ color: "#666", fontWeight: 500 }}>{label}</span>
      <span style={{ color: accent ? accentColor : "#111", fontWeight: accent ? 700 : 500 }}>{value}</span>
    </div>
  );
  const methodLabels: Record<string, string> = {
    cash: "Cash", bank_transfer: "Bank Transfer", card: "Card / POS", online: "Online", cheque: "Cheque",
  };
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: "#999", textTransform: "uppercase" as const, letterSpacing: "0.06em", padding: "10px 16px 4px" }}>Payment Details</div>
      {row("Invoice No.", data.invoiceNo ?? data.docNo ?? "—")}
      {row("Payment Date", fmtDate(data.paymentDate))}
      {row("Amount Paid", fmt(data.paymentAmount), true)}
      {row("Payment Method", methodLabels[data.paymentMethod ?? ""] ?? (data.paymentMethod ?? "—"))}
      {data.paymentRef && row("Reference", data.paymentRef)}
      <div style={{ fontSize: 9, fontWeight: 600, color: "#999", textTransform: "uppercase" as const, letterSpacing: "0.06em", padding: "10px 16px 4px" }}>Client</div>
      {row("Name", data.customer?.name ?? "—")}
      {data.customer?.phone && row("Phone", data.customer.phone)}
      <div style={{ margin: "10px 16px", padding: 10, borderRadius: 6, background: (data.remainingBalance ?? 0) === 0 ? "#f0fdf4" : "#fff7ed", border: `1px solid ${(data.remainingBalance ?? 0) === 0 ? "#86efac" : "#fed7aa"}` }}>
        <div style={{ fontSize: 8, fontWeight: 600, color: (data.remainingBalance ?? 0) === 0 ? "#16a34a" : "#ea580c" }}>{(data.remainingBalance ?? 0) === 0 ? "FULLY PAID" : "BALANCE DUE"}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: (data.remainingBalance ?? 0) === 0 ? "#16a34a" : "#ea580c" }}>{fmt(data.remainingBalance ?? 0)}</div>
      </div>
    </div>
  );
}

// ─── Template: Classic Corporate ─────────────────────────────────────────────
function ClassicDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate }: TemplateProps) {
  const accent = cfg.accentColor ?? "#c8a96e";
  const isReceipt = data.type === "receipt";
  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: cfg.fontFamily, width: 595, minHeight: 800 }}>
      {/* Header */}
      <div style={{ background: cfg.headerBg, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>{companyName}</div>
          {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>{data.companyAddress}</div>}
          {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)" }}>{data.companyPhone}</div>}
          {data.companyEmail && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.7)" }}>{data.companyEmail}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{typeLabel}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{docNo}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>Issued: {fmtDate(data.issueDate)}</div>
          {data.dueDate && <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>Due: {fmtDate(data.dueDate)}</div>}
        </div>
      </div>
      {/* Divider */}
      <div style={{ height: 3, background: accent }} />
      {/* Bill to / Details */}
      {!isReceipt && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid #e5e7eb`, margin: "0 24px" }}>
          <div style={{ padding: "12px 0 12px 0", borderRight: "0.5px solid #e5e7eb", paddingRight: 12 }}>
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", marginBottom: 4 }}>Bill To</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#111" }}>{data.customer?.name ?? "—"}</div>
            {data.customer?.company && <div style={{ fontSize: 8, color: "#555" }}>{data.customer.company}</div>}
            {data.customer?.phone && <div style={{ fontSize: 8, color: "#666" }}>{data.customer.phone}</div>}
            {data.customer?.address && <div style={{ fontSize: 8, color: "#666", marginTop: 2 }}>{data.customer.address}</div>}
          </div>
          <div style={{ padding: "12px 0 12px 12px" }}>
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", marginBottom: 4 }}>Document Details</div>
            <div style={{ fontSize: 8, color: "#333", marginBottom: 2 }}><strong>Date:</strong> {fmtDate(data.issueDate)}</div>
            {data.dueDate && <div style={{ fontSize: 8, color: "#333", marginBottom: 2 }}><strong>{data.type === "quotation" ? "Valid Until:" : "Due:"}</strong> {fmtDate(data.dueDate)}</div>}
            <div style={{ fontSize: 8, color: "#333" }}><strong>Currency:</strong> {data.currency ?? "PKR"}</div>
          </div>
        </div>
      )}
      {/* Items / Receipt body */}
      <div style={{ margin: "0 24px" }}>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
            <TotalsBlock data={data} cfg={cfg} fmt={fmt} />
          </>
        }
      </div>
      {/* Footer */}
      <div style={{ margin: "12px 24px 0", borderTop: `1px solid ${accent}40`, paddingTop: 8 }}>
        {cfg.showTerms && data.termsText && <div style={{ fontSize: 7.5, color: "#777", lineHeight: 1.5 }}>{data.termsText}</div>}
        {cfg.footerText && <div style={{ fontSize: 7.5, color: "#888", marginTop: 4, textAlign: "center" }}>{cfg.footerText}</div>}
        {!cfg.footerText && <div style={{ fontSize: 7.5, color: "#888", textAlign: "center", marginTop: 4 }}>Thank you for your business.</div>}
      </div>
    </div>
  );
}

// ─── Template: Modern Gradient ───────────────────────────────────────────────
function ModernGradientDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate }: TemplateProps) {
  const accent = cfg.accentColor ?? "#6366f1";
  const isReceipt = data.type === "receipt";
  return (
    <div style={{ background: "#fff", color: "#1f2937", fontFamily: cfg.fontFamily, width: 595, minHeight: 800 }}>
      {/* Gradient header */}
      <div style={{ background: cfg.headerBg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "#fff" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{companyName}</div>
          {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, opacity: 0.8, marginTop: 2 }}>{data.companyAddress}</div>}
          {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, opacity: 0.75 }}>{data.companyPhone}</div>}
          {data.companyEmail && <div style={{ fontSize: 8, opacity: 0.75 }}>{data.companyEmail}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.75, marginBottom: 2 }}>{typeLabel}</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{docNo}</div>
          <div style={{ fontSize: 8, opacity: 0.65, marginTop: 4 }}>Issued: {fmtDate(data.issueDate)}</div>
          {data.dueDate && <div style={{ fontSize: 8, opacity: 0.65 }}>Due: {fmtDate(data.dueDate)}</div>}
        </div>
      </div>
      {/* Meta */}
      {!isReceipt && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "0.5px solid #f0f0f0" }}>
          <div style={{ padding: "10px 16px", borderRight: "0.5px solid #f0f0f0" }}>
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", marginBottom: 3 }}>Bill To</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#111" }}>{data.customer?.name ?? "—"}</div>
            {data.customer?.company && <div style={{ fontSize: 8, color: "#555" }}>{data.customer.company}</div>}
            {data.customer?.phone && <div style={{ fontSize: 8, color: "#666" }}>{data.customer.phone}</div>}
            {data.customer?.address && <div style={{ fontSize: 8, color: "#666", marginTop: 2 }}>{data.customer.address}</div>}
          </div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#999", marginBottom: 3 }}>Details</div>
            <div style={{ fontSize: 8, color: "#333", marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</div>
            {data.dueDate && <div style={{ fontSize: 8, color: "#333", marginBottom: 2 }}>{data.type === "quotation" ? "Valid Until:" : "Due:"} {fmtDate(data.dueDate)}</div>}
            <div style={{ fontSize: 8, color: "#333" }}>Currency: {data.currency ?? "PKR"}</div>
          </div>
        </div>
      )}
      <div style={{ padding: "0 0" }}>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
            <TotalsBlock data={data} cfg={cfg} fmt={fmt} />
          </>
        }
      </div>
      <div style={{ borderTop: `1.5px solid ${accent}`, margin: "12px 16px 0", paddingTop: 8 }}>
        {cfg.showTerms && data.termsText && <div style={{ fontSize: 7.5, color: "#777", lineHeight: 1.5 }}>{data.termsText}</div>}
        {cfg.footerText
          ? <div style={{ fontSize: 7.5, color: "#888", textAlign: "center" }}>{cfg.footerText}</div>
          : <div style={{ fontSize: 7.5, color: "#888", textAlign: "center" }}>Thank you for your business.</div>}
      </div>
    </div>
  );
}

// ─── Template: Minimal Clean ─────────────────────────────────────────────────
function MinimalDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate }: TemplateProps) {
  const accent = cfg.accentColor ?? "#374151";
  const isReceipt = data.type === "receipt";
  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: cfg.fontFamily, width: 595, minHeight: 800, padding: "28px 32px" }}>
      {/* Minimal header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", letterSpacing: "-0.01em" }}>{companyName}</div>
          {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "#888", marginTop: 3 }}>{data.companyAddress}</div>}
          {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "#888" }}>{data.companyPhone}</div>}
          {data.companyEmail && <div style={{ fontSize: 8, color: "#888" }}>{data.companyEmail}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>{typeLabel}</div>
          <div style={{ fontSize: 10, color: "#666", fontWeight: 500 }}>#{docNo}</div>
        </div>
      </div>
      {/* Hairline divider */}
      <div style={{ height: 0.5, background: "#d1d5db", marginBottom: 20 }} />
      {/* Meta */}
      {!isReceipt && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: 5 }}>Bill To</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#111" }}>{data.customer?.name ?? "—"}</div>
            {data.customer?.company && <div style={{ fontSize: 8, color: "#666" }}>{data.customer.company}</div>}
            {data.customer?.phone && <div style={{ fontSize: 8, color: "#666" }}>{data.customer.phone}</div>}
            {data.customer?.address && <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>{data.customer.address}</div>}
          </div>
          <div>
            <div style={{ fontSize: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", marginBottom: 5 }}>Details</div>
            <div style={{ fontSize: 8, color: "#444", marginBottom: 2 }}>Issued {fmtDate(data.issueDate)}</div>
            {data.dueDate && <div style={{ fontSize: 8, color: "#444", marginBottom: 2 }}>{data.type === "quotation" ? "Valid until" : "Due"} {fmtDate(data.dueDate)}</div>}
            <div style={{ fontSize: 8, color: "#888" }}>{data.currency ?? "PKR"}</div>
          </div>
        </div>
      )}
      <div>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
            <TotalsBlock data={data} cfg={cfg} fmt={fmt} />
          </>
        }
      </div>
      <div style={{ height: 0.5, background: "#d1d5db", margin: "16px 0 8px" }} />
      {cfg.showTerms && data.termsText && <div style={{ fontSize: 7.5, color: "#9ca3af", lineHeight: 1.6 }}>{data.termsText}</div>}
      {cfg.footerText
        ? <div style={{ fontSize: 7.5, color: "#9ca3af", textAlign: "center" }}>{cfg.footerText}</div>
        : <div style={{ fontSize: 7.5, color: "#9ca3af", textAlign: "center" }}>Thank you.</div>}
    </div>
  );
}

// ─── Template: Executive Dark ────────────────────────────────────────────────
function ExecutiveDarkDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate }: TemplateProps) {
  const accent = cfg.accentColor ?? "#94a3b8";
  const isReceipt = data.type === "receipt";

  function DarkItemsTable() {
    const displayItems = (data.items ?? []).filter(i => i.name);
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
        <thead>
          <tr>
            {["Description", "Qty", "Rate", "Total"].map((h, i) => (
              <th key={h} style={{
                padding: "7px 10px", fontSize: 7.5, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: accent, textAlign: i === 0 ? "left" : "right",
                borderBottom: `1px solid rgba(148,163,184,0.2)`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayItems.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: 12, textAlign: "center", color: "#64748b", fontSize: 8 }}>No items</td></tr>
          ) : displayItems.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
              <td style={{ padding: "6px 10px", color: "#e2e8f0", fontSize: 9, borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{item.name}</td>
              <td style={{ padding: "6px 10px", color: "#94a3b8", textAlign: "right", fontSize: 9, borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{item.quantity}</td>
              <td style={{ padding: "6px 10px", color: "#94a3b8", textAlign: "right", fontSize: 9, borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{item.price.toLocaleString()}</td>
              <td style={{ padding: "6px 10px", color: "#f8fafc", textAlign: "right", fontWeight: 600, fontSize: 9, borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{(item.quantity * item.price).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ background: "#1e293b", color: "#e2e8f0", fontFamily: cfg.fontFamily, width: 595, minHeight: 800 }}>
      {/* Dark header */}
      <div style={{ background: cfg.headerBg, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid rgba(148,163,184,0.15)` }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{companyName}</div>
          {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "#64748b", marginTop: 3 }}>{data.companyAddress}</div>}
          {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "#64748b" }}>{data.companyPhone}</div>}
          {data.companyEmail && <div style={{ fontSize: 8, color: "#64748b" }}>{data.companyEmail}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, color: accent, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>{typeLabel}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>{docNo}</div>
          <div style={{ fontSize: 8, color: "#64748b", marginTop: 3 }}>{fmtDate(data.issueDate)}</div>
          {data.dueDate && <div style={{ fontSize: 8, color: "#64748b" }}>Due {fmtDate(data.dueDate)}</div>}
        </div>
      </div>
      {/* Meta */}
      {!isReceipt && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "0.5px solid rgba(255,255,255,0.07)", margin: "0 22px" }}>
          <div style={{ padding: "10px 0", borderRight: "0.5px solid rgba(255,255,255,0.07)", paddingRight: 16 }}>
            <div style={{ fontSize: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: 4 }}>Bill To</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#f1f5f9" }}>{data.customer?.name ?? "—"}</div>
            {data.customer?.phone && <div style={{ fontSize: 8, color: "#64748b" }}>{data.customer.phone}</div>}
            {data.customer?.address && <div style={{ fontSize: 8, color: "#64748b", marginTop: 2 }}>{data.customer.address}</div>}
          </div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ fontSize: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#475569", marginBottom: 4 }}>Details</div>
            <div style={{ fontSize: 8, color: "#94a3b8", marginBottom: 2 }}>Issued: {fmtDate(data.issueDate)}</div>
            {data.dueDate && <div style={{ fontSize: 8, color: "#94a3b8" }}>Due: {fmtDate(data.dueDate)}</div>}
          </div>
        </div>
      )}
      <div style={{ padding: "0 22px" }}>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <DarkItemsTable />
            {/* Dark totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10 }}>
              <div style={{ minWidth: 160 }}>
                {cfg.showTax && data.taxAmt !== undefined && data.taxAmt > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#64748b", marginBottom: 3 }}><span>{data.taxLabel ?? "Tax"}</span><span>{fmt(data.taxAmt)}</span></div>
                )}
                {cfg.showDiscount && data.discount !== undefined && data.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#4ade80", marginBottom: 3 }}><span>Discount</span><span>-{fmt(data.discount)}</span></div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, borderTop: `1px solid ${accent}50`, paddingTop: 5, marginTop: 3, color: "#f8fafc" }}>
                  <span>Total</span><span style={{ color: accent }}>{fmt(data.total)}</span>
                </div>
                {data.type === "invoice" && (data.outstanding ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#f87171", marginTop: 3 }}><span>Outstanding</span><span>{fmt(data.outstanding)}</span></div>
                )}
              </div>
            </div>
          </>
        }
      </div>
      <div style={{ margin: "12px 22px 0", borderTop: `0.5px solid rgba(255,255,255,0.08)`, paddingTop: 8 }}>
        {cfg.showTerms && data.termsText && <div style={{ fontSize: 7.5, color: "#475569", lineHeight: 1.5 }}>{data.termsText}</div>}
        {cfg.footerText
          ? <div style={{ fontSize: 7.5, color: "#475569", textAlign: "center" }}>{cfg.footerText}</div>
          : <div style={{ fontSize: 7.5, color: "#475569", textAlign: "center" }}>Thank you for your business.</div>}
      </div>
    </div>
  );
}

// ─── Template: Bold Accent ───────────────────────────────────────────────────
function BoldAccentDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate }: TemplateProps) {
  const accent = cfg.accentColor ?? "#f97316";
  const isReceipt = data.type === "receipt";
  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: cfg.fontFamily, width: 595, minHeight: 800, display: "flex" }}>
      {/* Left accent bar */}
      <div style={{ width: 5, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        {/* Header area (no colored block, just text) */}
        <div style={{ padding: "20px 22px 12px", borderBottom: `2px solid ${accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111", letterSpacing: "-0.01em" }}>{companyName}</div>
              {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>{data.companyAddress}</div>}
              {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "#888" }}>{data.companyPhone}</div>}
              {data.companyEmail && <div style={{ fontSize: 8, color: "#888" }}>{data.companyEmail}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>{typeLabel}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#111", letterSpacing: "-0.02em" }}>{docNo}</div>
              <div style={{ fontSize: 8, color: "#888" }}>{fmtDate(data.issueDate)}</div>
              {data.dueDate && <div style={{ fontSize: 8, color: "#888" }}>Due {fmtDate(data.dueDate)}</div>}
            </div>
          </div>
        </div>
        {/* Meta */}
        {!isReceipt && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "10px 22px", borderBottom: `1px solid ${accent}20` }}>
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: accent, letterSpacing: "0.1em", marginBottom: 4 }}>Bill To</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{data.customer?.name ?? "—"}</div>
              {data.customer?.company && <div style={{ fontSize: 8, color: "#666" }}>{data.customer.company}</div>}
              {data.customer?.phone && <div style={{ fontSize: 8, color: "#666" }}>{data.customer.phone}</div>}
              {data.customer?.address && <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>{data.customer.address}</div>}
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: accent, letterSpacing: "0.1em", marginBottom: 4 }}>Details</div>
              <div style={{ fontSize: 8, color: "#555", marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</div>
              {data.dueDate && <div style={{ fontSize: 8, color: "#555" }}>{data.type === "quotation" ? "Valid Until:" : "Due:"} {fmtDate(data.dueDate)}</div>}
              <div style={{ fontSize: 8, color: "#888" }}>Currency: {data.currency ?? "PKR"}</div>
            </div>
          </div>
        )}
        <div style={{ padding: "0 22px" }}>
          {isReceipt
            ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
            : <>
              <div style={{ marginTop: 6 }}>
                <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
              </div>
              <TotalsBlock data={data} cfg={cfg} fmt={fmt} />
            </>
          }
        </div>
        <div style={{ margin: "12px 22px 0", borderTop: `2px solid ${accent}`, paddingTop: 8 }}>
          {cfg.showTerms && data.termsText && <div style={{ fontSize: 7.5, color: "#777", lineHeight: 1.5 }}>{data.termsText}</div>}
          {cfg.footerText
            ? <div style={{ fontSize: 7.5, color: "#888", textAlign: "center" }}>{cfg.footerText}</div>
            : <div style={{ fontSize: 7.5, color: "#888", textAlign: "center" }}>Thank you for your business.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Template: Retro Serif ───────────────────────────────────────────────────
function RetroSerifDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate }: TemplateProps) {
  const accent = cfg.accentColor ?? "#8b4513";
  const isReceipt = data.type === "receipt";
  return (
    <div style={{ background: "#faf7f0", color: "#2d1b00", fontFamily: cfg.fontFamily, width: 595, minHeight: 800, padding: 16 }}>
      {/* Decorative border frame */}
      <div style={{ border: `2px solid ${accent}`, borderRadius: 2, padding: "18px 22px", minHeight: 760 }}>
        <div style={{ border: `0.5px solid ${accent}60`, borderRadius: 1, padding: "14px 18px", minHeight: 724 }}>
          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: `1px solid ${accent}40`, paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: accent, letterSpacing: "0.04em" }}>{companyName}</div>
            {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "#7c5533", marginTop: 2 }}>{data.companyAddress}</div>}
            {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "#7c5533" }}>{data.companyPhone}</div>}
            {data.companyEmail && <div style={{ fontSize: 8, color: "#7c5533" }}>{data.companyEmail}</div>}
          </div>
          {/* Document type & number */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, borderTop: `0.5px solid ${accent}40`, borderBottom: `0.5px solid ${accent}40`, padding: "4px 0", display: "inline-block", minWidth: 140 }}>{typeLabel}</div>
            <div style={{ fontSize: 10, color: "#7c5533", marginTop: 4, fontStyle: "italic" }}>No. {docNo}</div>
            <div style={{ fontSize: 8, color: "#7c5533" }}>Issued: {fmtDate(data.issueDate)}{data.dueDate ? ` · Due: ${fmtDate(data.dueDate)}` : ""}</div>
          </div>
          {/* Meta */}
          {!isReceipt && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, borderBottom: `0.5px solid ${accent}30`, paddingBottom: 12 }}>
              <div>
                <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: accent, marginBottom: 4 }}>To</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#2d1b00" }}>{data.customer?.name ?? "—"}</div>
                {data.customer?.company && <div style={{ fontSize: 8, color: "#7c5533", fontStyle: "italic" }}>{data.customer.company}</div>}
                {data.customer?.phone && <div style={{ fontSize: 8, color: "#7c5533" }}>{data.customer.phone}</div>}
                {data.customer?.address && <div style={{ fontSize: 8, color: "#7c5533", marginTop: 2 }}>{data.customer.address}</div>}
              </div>
              <div>
                <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: accent, marginBottom: 4 }}>Document</div>
                <div style={{ fontSize: 8, color: "#7c5533", marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</div>
                {data.dueDate && <div style={{ fontSize: 8, color: "#7c5533" }}>{data.type === "quotation" ? "Valid Until:" : "Due:"} {fmtDate(data.dueDate)}</div>}
                <div style={{ fontSize: 8, color: "#7c5533" }}>Currency: {data.currency ?? "PKR"}</div>
              </div>
            </div>
          )}
          {isReceipt
            ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
            : <>
              <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
              <TotalsBlock data={data} cfg={cfg} fmt={fmt} />
            </>
          }
          <div style={{ borderTop: `0.5px solid ${accent}40`, marginTop: 14, paddingTop: 8 }}>
            {cfg.showTerms && data.termsText && <div style={{ fontSize: 7.5, color: "#7c5533", lineHeight: 1.6, fontStyle: "italic" }}>{data.termsText}</div>}
            {cfg.footerText
              ? <div style={{ fontSize: 8, color: accent, textAlign: "center", fontStyle: "italic" }}>{cfg.footerText}</div>
              : <div style={{ fontSize: 8, color: accent, textAlign: "center", fontStyle: "italic" }}>With gratitude for your business.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared type for template props ─────────────────────────────────────────
interface TemplateProps {
  cfg: ReturnType<typeof resolveConfig>;
  data: DocumentData;
  typeLabel: string;
  docNo: string;
  companyName: string;
  fmt: (n?: number) => string;
  fmtDate: (d?: string) => string;
}
