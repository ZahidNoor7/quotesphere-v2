"use client";
/**
 * Vector PDF generation using @react-pdf/renderer.
 * Each template faithfully matches the DocumentRenderer HTML output.
 */
import type React from "react";
import { Document, Page, View, Text, StyleSheet, pdf, Svg, Defs, LinearGradient, Stop, Rect } from "@react-pdf/renderer";
import type { DocumentDesign } from "@/types";
import { resolveConfig } from "@/lib/document-designs";
import { downloadFile } from "@/lib/pdf-export";

// ─── Font helpers ──────────────────────────────────────────────────────────────
function getPdfFont(fontFamily: string): "Helvetica" | "Times-Roman" {
  // Check sans-serif FIRST — "sans-serif" contains "serif" as a substring
  if (/sans-serif/i.test(fontFamily)) return "Helvetica";
  if (/georgia|times|\bserif\b/i.test(fontFamily)) return "Times-Roman";
  return "Helvetica";
}
function boldOf(f: string) { return f === "Times-Roman" ? "Times-Bold" : "Helvetica-Bold"; }
function italicOf(f: string) { return f === "Times-Roman" ? "Times-Italic" : "Helvetica-Oblique"; }

// ─── Color helpers ─────────────────────────────────────────────────────────────
function extractSolid(bg: string): string {
  if (!bg || bg === "transparent") return "#ffffff";
  const m = bg.match(/#[0-9a-fA-F]{6}/);
  if (m) return m[0];
  if (bg.startsWith("#")) return bg.slice(0, 7);
  return "#ffffff";
}
/** Convert a 6-digit hex color + alpha (0-1) to rgba() — react-pdf doesn't support 8-digit hex. */
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Gradient helpers ──────────────────────────────────────────────────────────
/** Extract the first two hex colors from a CSS gradient string, or null if not a gradient. */
function parseGradientColors(bg: string): [string, string] | null {
  if (!bg.includes("gradient")) return null;
  const hexes = bg.match(/#[0-9a-fA-F]{6}/g);
  if (hexes && hexes.length >= 2) return [hexes[0], hexes[hexes.length - 1]];
  return null;
}
// Point widths for supported page sizes (portrait orientation).
// Used to size the gradient SVG so the full gradient range is visible.
const PDF_PAGE_WIDTHS: Record<string, number> = { A4: 595, Letter: 612, A3: 842, A5: 420 };

/**
 * Renders a View with a true SVG LinearGradient background.
 * react-pdf's SVG renderer produces smooth vector gradients in the PDF —
 * no banding or strip artifacts.
 * Falls back to a solid color for non-gradient backgrounds.
 *
 * `pageWidth` must match the page size so the gradient covers the full width.
 * A4 portrait = 595pt (default). Using the wrong width causes the gradient
 * to be clipped mid-transition, so color B never fully appears.
 */
function GradientView({
  bg, wrapperStyle = {}, contentStyle = {}, children, pageWidth = 595,
}: {
  bg: string;
  wrapperStyle?: Record<string, any>;
  contentStyle?: Record<string, any>;
  children?: React.ReactNode;
  pageWidth?: number;
}) {
  const colors = parseGradientColors(bg);
  if (!colors) {
    return (
      <View style={{ ...wrapperStyle, backgroundColor: extractSolid(bg) }}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ ...wrapperStyle, position: "relative", overflow: "hidden" }}>
      {/* True SVG linear gradient — clipped to parent bounds via overflow:hidden */}
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <Svg width={pageWidth} height={300}>
          <Defs>
            {/* objectBoundingBox coords: 0,0 = top-left → 1,1 = bottom-right (≈135°) */}
            <LinearGradient id="hGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={colors[0]} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors[1]} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={pageWidth} height={300} fill="url(#hGrad)" />
        </Svg>
      </View>
      {/* Content rendered on top */}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

// ─── Formatting ────────────────────────────────────────────────────────────────
const SYM: Record<string, string> = { PKR: "Rs. ", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SAR: "SAR " };
function fmtAmt(n?: number, currency?: string) {
  if (n === undefined || n === null) return "";
  const p = SYM[currency ?? ""] ?? (currency ? currency + " " : "");
  return `${p}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n?: number) { return (n ?? 0).toLocaleString(); }
function fmtDate(d?: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
}

// ─── DocData type ──────────────────────────────────────────────────────────────
export interface DocData {
  type: "invoice" | "quotation" | "receipt";
  docNo: string;
  issueDate: string;
  dueDate?: string;
  customer: { name: string; phone?: string; address?: string; company?: string };
  items?: { id: number; name: string; quantity: number; price: number }[];
  subTotal?: number;
  taxAmt?: number;
  taxLabel?: string;
  discount?: number;
  delivery?: number;
  total: number;
  advance?: number;
  outstanding?: number;
  currency?: string;
  remarks?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  termsText?: string;
  invoiceNo?: string;
  paymentDate?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  paymentRef?: string;
  remainingBalance?: number;
}

type Cfg = ReturnType<typeof resolveConfig>;

// ─── Shared: Items table ───────────────────────────────────────────────────────
function PdfItemsTable({
  items, cfg, font, bold, darkMode = false,
}: { items: DocData["items"]; cfg: Cfg; font: string; bold: string; darkMode?: boolean }) {
  const accent = cfg.accentColor ?? "#6366f1";
  const ts = cfg.tableStyle ?? "striped";
  const rows = (items ?? []).filter(i => i.name);

  const thBg = ts === "bordered" ? accent : ts === "striped" ? hexAlpha(accent, 0.07) : "transparent";
  const thColor = darkMode ? accent : ts === "bordered" ? "#ffffff" : accent;

  const S = StyleSheet.create({
    header: {
      flexDirection: "row",
      backgroundColor: darkMode ? undefined : thBg,
      paddingTop: 6, paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: darkMode ? "rgba(148,163,184,0.2)" : (ts === "minimal" ? hexAlpha(accent, 0.19) : hexAlpha(accent, 0.25)),
    },
    row: { flexDirection: "row", paddingTop: 6, paddingBottom: 6 },
    thText: { fontFamily: bold, fontSize: 7.5, color: thColor, textTransform: "uppercase", letterSpacing: 0.5 },
    tdNum: { fontFamily: font, fontSize: 8, color: darkMode ? "#475569" : "#888888", textAlign: "center" },
    tdName: { fontFamily: font, fontSize: 9, color: darkMode ? "#e2e8f0" : "#222222" },
    tdQty: { fontFamily: font, fontSize: 9, color: darkMode ? "#94a3b8" : "#555555", textAlign: "right" },
    tdRate: { fontFamily: font, fontSize: 9, color: darkMode ? "#94a3b8" : "#555555", textAlign: "right" },
    tdTotal: { fontFamily: bold, fontSize: 9, color: darkMode ? "#f8fafc" : "#111111", textAlign: "right" },
    colNum: { width: 20, paddingLeft: 4, paddingRight: 4 },
    colDesc: { flex: 3, paddingLeft: 10, paddingRight: 10 },
    colQty: { width: 40, paddingRight: 10 },
    colRate: { width: 80, paddingRight: 10 },
    colTotal: { width: 80, paddingRight: 10 },
  });

  return (
    <View>
      <View style={S.header}>
        <Text style={[S.thText, S.colNum]}>#</Text>
        <Text style={[S.thText, S.colDesc]}>Description</Text>
        <Text style={[S.thText, S.colQty]}>Qty</Text>
        <Text style={[S.thText, S.colRate]}>Rate</Text>
        <Text style={[S.thText, S.colTotal]}>Total</Text>
      </View>
      {rows.map((item, idx) => {
        const evenBg = ts === "striped" && idx % 2 === 1 ? hexAlpha(accent, 0.03) : undefined;
        const rowBorderColor = darkMode
          ? "rgba(255,255,255,0.06)"
          : ts === "bordered" ? hexAlpha(accent, 0.19) : ts === "striped" ? "rgba(0,0,0,0.05)" : undefined;
        return (
          <View
            key={`${item.id}-${idx}`}
            style={[S.row, {
              backgroundColor: darkMode ? (idx % 2 === 1 ? "rgba(255,255,255,0.03)" : undefined) : evenBg,
              borderBottomWidth: rowBorderColor ? 0.5 : 0,
              borderBottomColor: rowBorderColor ?? "transparent",
              borderRightWidth: 0,
            }]}
            wrap={false}
          >
            <Text style={[S.tdNum, S.colNum]}>{idx + 1}</Text>
            <Text style={[S.tdName, S.colDesc]}>{item.name}</Text>
            <Text style={[S.tdQty, S.colQty]}>{item.quantity}</Text>
            <Text style={[S.tdRate, S.colRate]}>{fmtNum(item.price)}</Text>
            <Text style={[S.tdTotal, S.colTotal]}>{fmtNum(item.quantity * item.price)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Shared: Totals block ──────────────────────────────────────────────────────
function PdfTotalsBlock({
  data, cfg, font, bold, darkMode = false,
}: { data: DocData; cfg: Cfg; font: string; bold: string; darkMode?: boolean }) {
  const accent = cfg.accentColor ?? "#6366f1";
  const cur = data.currency;
  const subColor = darkMode ? "#64748b" : "#555555";
  const totalColor = darkMode ? "#f8fafc" : "#111111";

  const row = (label: string, value: string, color?: string) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
      <Text style={{ fontSize: 8.5, color: subColor, fontFamily: font }}>{label}</Text>
      <Text style={{ fontSize: 8.5, color: color ?? subColor, fontFamily: font }}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingLeft: 12, paddingRight: 12, paddingTop: 10 }}>
      <View style={{ minWidth: 160 }}>
        {cfg.showTax && (data.taxAmt ?? 0) > 0 && row(data.taxLabel ?? "Tax", fmtAmt(data.taxAmt, cur))}
        {cfg.showDiscount && (data.discount ?? 0) > 0 && row("Discount", `-${fmtAmt(data.discount, cur)}`, "#16a34a")}
        {(data.delivery ?? 0) > 0 && row("Delivery", fmtAmt(data.delivery, cur))}
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: accent, paddingTop: 6, marginTop: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: bold, color: totalColor }}>Total</Text>
          <Text style={{ fontSize: 11, fontFamily: bold, color: accent }}>{fmtAmt(data.total, cur)}</Text>
        </View>
        {data.type === "invoice" && (data.advance ?? 0) > 0 && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ fontSize: 8.5, color: "#16a34a", fontFamily: font }}>Advance paid</Text>
            <Text style={{ fontSize: 8.5, color: "#16a34a", fontFamily: font }}>{fmtAmt(data.advance, cur)}</Text>
          </View>
        )}
        {data.type === "invoice" && (data.outstanding ?? 0) > 0 && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: 9, fontFamily: bold, color: "#dc2626" }}>Outstanding</Text>
            <Text style={{ fontSize: 9, fontFamily: bold, color: "#dc2626" }}>{fmtAmt(data.outstanding, cur)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Shared: Remarks block ─────────────────────────────────────────────────────
function PdfRemarks({ remarks, accent, textColor, font }: { remarks?: string; accent: string; textColor: string; font: string }) {
  if (!remarks) return null;
  return (
    <View style={{ marginTop: 8, paddingTop: 7, paddingBottom: 7, paddingLeft: 10, paddingRight: 10, backgroundColor: hexAlpha(accent, 0.04), borderLeftWidth: 2, borderLeftColor: hexAlpha(accent, 0.25) }}>
      <Text style={{ fontFamily: boldOf(font), fontSize: 7, color: accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Notes</Text>
      <Text style={{ fontSize: 8, color: textColor, lineHeight: 1.5, fontFamily: font }}>{remarks}</Text>
    </View>
  );
}

// ─── Shared: Footer ────────────────────────────────────────────────────────────
function PdfFooter({ cfg, data, borderColor, textColor, font, italic = false }: {
  cfg: Cfg; data: DocData; borderColor: string; textColor: string; font: string; italic?: boolean;
}) {
  if (cfg.footerEnabled === false) return null;
  const tc = cfg.footerTextColor || textColor;
  const fontFamily = italic ? italicOf(font) : font;
  const resolvedTermsText = cfg.termsText || data.termsText;
  const showTerms = cfg.showTerms && !!resolvedTermsText;

  return (
    <View style={{ borderTopWidth: 0.5, borderTopColor: borderColor, marginTop: 12, paddingTop: 8, paddingBottom: 8 }}>
      {showTerms && (
        <Text style={{ fontSize: 7.5, color: tc, lineHeight: 1.5, fontFamily, marginBottom: 5 }}>
          {resolvedTermsText}
        </Text>
      )}
      <View style={{ flexDirection: "row", justifyContent: cfg.showPageNumber ? "space-between" : "center" }}>
        <Text style={{ fontSize: 7.5, color: tc, fontFamily }}>
          {cfg.footerText || "Thank you for your business."}
        </Text>
        {cfg.showPageNumber && (
          <Text
            style={{ fontSize: 7.5, color: tc, fontFamily }}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        )}
      </View>
    </View>
  );
}

// ─── Shared: Bill-to + Details 2-col section ───────────────────────────────────
function PdfBillTo({ data, labelColor, nameColor, infoColor, font, bold, borderColor }: {
  data: DocData; labelColor: string; nameColor: string; infoColor: string; font: string; bold: string; borderColor?: string;
}) {
  const dueLabel = data.type === "quotation" ? "Valid Until:" : "Due:";
  return (
    <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: borderColor ?? "#e5e7eb" }}>
      <View style={{ flex: 1, paddingTop: 10, paddingBottom: 12, paddingRight: 12, borderRightWidth: 0.5, borderRightColor: borderColor ?? "#e5e7eb" }}>
        <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.8, color: labelColor, marginBottom: 4 }}>Bill To</Text>
        <Text style={{ fontSize: 10, fontFamily: bold, color: nameColor, marginBottom: 2 }}>{data.customer.name ?? "—"}</Text>
        {data.customer.company && <Text style={{ fontSize: 8, color: infoColor, fontFamily: font }}>{data.customer.company}</Text>}
        {data.customer.phone && <Text style={{ fontSize: 8, color: infoColor, fontFamily: font }}>{data.customer.phone}</Text>}
        {data.customer.address && <Text style={{ fontSize: 8, color: infoColor, fontFamily: font, marginTop: 2 }}>{data.customer.address}</Text>}
      </View>
      <View style={{ flex: 1, paddingTop: 10, paddingBottom: 12, paddingLeft: 12 }}>
        <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.8, color: labelColor, marginBottom: 4 }}>Document Details</Text>
        <Text style={{ fontSize: 8, color: infoColor, fontFamily: font, marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</Text>
        {data.dueDate && <Text style={{ fontSize: 8, color: infoColor, fontFamily: font, marginBottom: 2 }}>{dueLabel} {fmtDate(data.dueDate)}</Text>}
        <Text style={{ fontSize: 8, color: infoColor, fontFamily: font }}>Currency: {data.currency ?? "PKR"}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — Classic Corporate
// ═══════════════════════════════════════════════════════════════════════════════
function ClassicPDF({ cfg, data, font, bold }: { cfg: Cfg; data: DocData; font: string; bold: string }) {
  const accent = cfg.accentColor ?? "#c8a96e";
  const mainTc = cfg.headerTextColor || "#ffffff";
  const subTc = "rgba(255,255,255,0.70)";
  const gap = cfg.contentGap ?? 12;

  return (
    <View style={{ backgroundColor: "#ffffff", flex: 1 }}>
      {/* Header */}
      <GradientView
        bg={cfg.headerBg ?? "#1a2744"}
        pageWidth={PDF_PAGE_WIDTHS[(cfg.pageSize as string) ?? "A4"] ?? 595}
        contentStyle={{ paddingTop: 18, paddingBottom: 18, paddingLeft: 24, paddingRight: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View>
          <Text style={{ fontSize: 16, fontFamily: bold, color: mainTc, letterSpacing: 0.3, marginBottom: 2 }}>{data.companyName ?? "Your Company"}</Text>
          {cfg.showAddress && data.companyAddress && <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 3 }}>{data.companyAddress}</Text>}
          {cfg.showPhone && data.companyPhone && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyPhone}</Text>}
          {data.companyEmail && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyEmail}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, fontFamily: bold, color: accent, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>
            {data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT"}
          </Text>
          <Text style={{ fontSize: 18, fontFamily: bold, color: mainTc }}>{data.docNo}</Text>
          <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 4 }}>Issued: {fmtDate(data.issueDate)}</Text>
          {data.dueDate && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>Due: {fmtDate(data.dueDate)}</Text>}
        </View>
      </GradientView>
      {/* Accent divider */}
      <View style={{ height: 3, backgroundColor: accent }} />
      {/* Bill-to */}
      {data.type !== "receipt" && (
        <View style={{ marginLeft: 24, marginRight: 24 }}>
          <PdfBillTo data={data} labelColor="#999999" nameColor="#111111" infoColor="#666666" font={font} bold={bold} borderColor="#e5e7eb" />
        </View>
      )}
      {/* Items */}
      <View style={{ marginLeft: 24, marginRight: 24, marginTop: gap }}>
        <PdfItemsTable items={data.items} cfg={cfg} font={font} bold={bold} />
        <PdfTotalsBlock data={data} cfg={cfg} font={font} bold={bold} />
        <PdfRemarks remarks={data.remarks} accent={accent} textColor="#555555" font={font} />
      </View>
      {/* Footer */}
      <View style={{ marginLeft: 24, marginRight: 24, marginTop: gap }}>
        <PdfFooter cfg={cfg} data={data} borderColor={hexAlpha(accent, 0.25)} textColor="#888888" font={font} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — Modern Gradient
// ═══════════════════════════════════════════════════════════════════════════════
function ModernGradientPDF({ cfg, data, font, bold }: { cfg: Cfg; data: DocData; font: string; bold: string }) {
  const accent = cfg.accentColor ?? "#6366f1";
  const mainTc = cfg.headerTextColor || "#ffffff";
  const subTc = "rgba(255,255,255,0.75)";
  const gap = cfg.contentGap ?? 12;
  const dueLabel = data.type === "quotation" ? "Valid Until:" : "Due:";

  return (
    <View style={{ backgroundColor: "#ffffff", flex: 1 }}>
      {/* Gradient header */}
      <GradientView
        bg={cfg.headerBg ?? "linear-gradient(135deg, #6366f1, #8b5cf6)"}
        pageWidth={PDF_PAGE_WIDTHS[(cfg.pageSize as string) ?? "A4"] ?? 595}
        contentStyle={{ paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View>
          <Text style={{ fontSize: 15, fontFamily: bold, color: mainTc, marginBottom: 2 }}>{data.companyName ?? "Your Company"}</Text>
          {cfg.showAddress && data.companyAddress && <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 2 }}>{data.companyAddress}</Text>}
          {cfg.showPhone && data.companyPhone && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyPhone}</Text>}
          {data.companyEmail && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyEmail}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 8, fontFamily: bold, letterSpacing: 1, textTransform: "uppercase", color: subTc, marginBottom: 2 }}>
            {data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT"}
          </Text>
          <Text style={{ fontSize: 17, fontFamily: bold, color: mainTc }}>{data.docNo}</Text>
          <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 4 }}>Issued: {fmtDate(data.issueDate)}</Text>
          {data.dueDate && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>Due: {fmtDate(data.dueDate)}</Text>}
        </View>
      </GradientView>
      {/* Meta */}
      {data.type !== "receipt" && (
        <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#f0f0f0" }}>
          <View style={{ flex: 1, paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderRightWidth: 0.5, borderRightColor: "#f0f0f0" }}>
            <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.8, color: "#999999", marginBottom: 3 }}>Bill To</Text>
            <Text style={{ fontSize: 10, fontFamily: bold, color: "#111111", marginBottom: 2 }}>{data.customer.name ?? "—"}</Text>
            {data.customer.company && <Text style={{ fontSize: 8, color: "#555555", fontFamily: font }}>{data.customer.company}</Text>}
            {data.customer.phone && <Text style={{ fontSize: 8, color: "#666666", fontFamily: font }}>{data.customer.phone}</Text>}
            {data.customer.address && <Text style={{ fontSize: 8, color: "#666666", fontFamily: font, marginTop: 2 }}>{data.customer.address}</Text>}
          </View>
          <View style={{ flex: 1, paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16 }}>
            <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.8, color: "#999999", marginBottom: 3 }}>Details</Text>
            <Text style={{ fontSize: 8, color: "#333333", fontFamily: font, marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</Text>
            {data.dueDate && <Text style={{ fontSize: 8, color: "#333333", fontFamily: font, marginBottom: 2 }}>{dueLabel} {fmtDate(data.dueDate)}</Text>}
            <Text style={{ fontSize: 8, color: "#333333", fontFamily: font }}>Currency: {data.currency ?? "PKR"}</Text>
          </View>
        </View>
      )}
      {/* Items */}
      <View style={{ paddingTop: gap }}>
        <PdfItemsTable items={data.items} cfg={cfg} font={font} bold={bold} />
        <PdfTotalsBlock data={data} cfg={cfg} font={font} bold={bold} />
        <View style={{ paddingLeft: 16, paddingRight: 16, marginTop: gap }}>
          <PdfRemarks remarks={data.remarks} accent={accent} textColor="#555555" font={font} />
        </View>
      </View>
      {/* Footer */}
      <View style={{ marginLeft: 16, marginRight: 16, marginTop: gap }}>
        <PdfFooter cfg={cfg} data={data} borderColor={accent} textColor="#888888" font={font} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — Minimal Clean
// ═══════════════════════════════════════════════════════════════════════════════
function MinimalPDF({ cfg, data, font, bold }: { cfg: Cfg; data: DocData; font: string; bold: string }) {
  const accent = cfg.accentColor ?? "#374151";
  const mainTc = cfg.headerTextColor || "#111111";
  const gap = cfg.contentGap ?? 12;
  const dueLabel = data.type === "quotation" ? "Valid until" : "Due";

  return (
    <View style={{ backgroundColor: "#ffffff", flex: 1, paddingTop: 28, paddingBottom: 28, paddingLeft: 32, paddingRight: 32 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: gap }}>
        <View>
          <Text style={{ fontSize: 14, fontFamily: bold, color: mainTc, letterSpacing: -0.1, marginBottom: 2 }}>{data.companyName ?? "Your Company"}</Text>
          {cfg.showAddress && data.companyAddress && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font, marginTop: 3 }}>{data.companyAddress}</Text>}
          {cfg.showPhone && data.companyPhone && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>{data.companyPhone}</Text>}
          {data.companyEmail && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>{data.companyEmail}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 22, fontFamily: bold, color: mainTc, letterSpacing: -0.2 }}>
            {data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT"}
          </Text>
          <Text style={{ fontSize: 10, color: "#666666", fontFamily: font }}>#{data.docNo}</Text>
        </View>
      </View>
      {/* Hairline divider */}
      <View style={{ height: 0.5, backgroundColor: "#d1d5db", marginBottom: gap }} />
      {/* Meta */}
      {data.type !== "receipt" && (
        <View style={{ flexDirection: "row", gap: 20, marginBottom: gap }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af", marginBottom: 5 }}>Bill To</Text>
            <Text style={{ fontSize: 10, fontFamily: bold, color: "#111111", marginBottom: 2 }}>{data.customer.name ?? "—"}</Text>
            {data.customer.company && <Text style={{ fontSize: 8, color: "#666666", fontFamily: font }}>{data.customer.company}</Text>}
            {data.customer.phone && <Text style={{ fontSize: 8, color: "#666666", fontFamily: font }}>{data.customer.phone}</Text>}
            {data.customer.address && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font, marginTop: 2 }}>{data.customer.address}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 1, color: "#9ca3af", marginBottom: 5 }}>Details</Text>
            <Text style={{ fontSize: 8, color: "#444444", fontFamily: font, marginBottom: 2 }}>Issued {fmtDate(data.issueDate)}</Text>
            {data.dueDate && <Text style={{ fontSize: 8, color: "#444444", fontFamily: font, marginBottom: 2 }}>{dueLabel} {fmtDate(data.dueDate)}</Text>}
            <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>{data.currency ?? "PKR"}</Text>
          </View>
        </View>
      )}
      {/* Items */}
      <PdfItemsTable items={data.items} cfg={cfg} font={font} bold={bold} />
      <PdfTotalsBlock data={data} cfg={cfg} font={font} bold={bold} />
      <View style={{ marginTop: gap }}>
        <PdfRemarks remarks={data.remarks} accent={accent} textColor="#444444" font={font} />
      </View>
      {/* Footer */}
      <PdfFooter cfg={cfg} data={data} borderColor="#d1d5db" textColor="#9ca3af" font={font} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 4 — Executive Dark
// ═══════════════════════════════════════════════════════════════════════════════
function ExecutiveDarkPDF({ cfg, data, font, bold }: { cfg: Cfg; data: DocData; font: string; bold: string }) {
  const accent = cfg.accentColor ?? "#94a3b8";
  const mainTc = cfg.headerTextColor || "#f8fafc";
  const subTc = "#64748b";
  const gap = cfg.contentGap ?? 12;

  return (
    <View style={{ backgroundColor: "#1e293b", flex: 1 }}>
      {/* Dark header */}
      <GradientView
        bg={cfg.headerBg ?? "#0f172a"}
        pageWidth={PDF_PAGE_WIDTHS[(cfg.pageSize as string) ?? "A4"] ?? 595}
        contentStyle={{ paddingTop: 18, paddingBottom: 18, paddingLeft: 22, paddingRight: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.15)" }}
      >
        <View>
          <Text style={{ fontSize: 14, fontFamily: bold, color: mainTc, marginBottom: 2 }}>{data.companyName ?? "Your Company"}</Text>
          {cfg.showAddress && data.companyAddress && <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 3 }}>{data.companyAddress}</Text>}
          {cfg.showPhone && data.companyPhone && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyPhone}</Text>}
          {data.companyEmail && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyEmail}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 8, fontFamily: bold, color: accent, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>
            {data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT"}
          </Text>
          <Text style={{ fontSize: 18, fontFamily: bold, color: mainTc }}>{data.docNo}</Text>
          <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 3 }}>{fmtDate(data.issueDate)}</Text>
          {data.dueDate && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>Due {fmtDate(data.dueDate)}</Text>}
        </View>
      </GradientView>
      {/* Meta */}
      {data.type !== "receipt" && (
        <View style={{ flexDirection: "row", marginLeft: 22, marginRight: 22, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.07)" }}>
          <View style={{ flex: 1, paddingTop: 10, paddingBottom: 10, paddingRight: 16, borderRightWidth: 0.5, borderRightColor: "rgba(255,255,255,0.07)" }}>
            <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.8, color: "#475569", marginBottom: 4 }}>Bill To</Text>
            <Text style={{ fontSize: 10, fontFamily: bold, color: "#f1f5f9", marginBottom: 2 }}>{data.customer.name ?? "—"}</Text>
            {data.customer.phone && <Text style={{ fontSize: 8, color: "#64748b", fontFamily: font }}>{data.customer.phone}</Text>}
            {data.customer.address && <Text style={{ fontSize: 8, color: "#64748b", fontFamily: font, marginTop: 2 }}>{data.customer.address}</Text>}
          </View>
          <View style={{ flex: 1, paddingTop: 10, paddingBottom: 10, paddingLeft: 16 }}>
            <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.8, color: "#475569", marginBottom: 4 }}>Details</Text>
            <Text style={{ fontSize: 8, color: "#94a3b8", fontFamily: font, marginBottom: 2 }}>Issued: {fmtDate(data.issueDate)}</Text>
            {data.dueDate && <Text style={{ fontSize: 8, color: "#94a3b8", fontFamily: font }}>Due: {fmtDate(data.dueDate)}</Text>}
          </View>
        </View>
      )}
      {/* Items — dark version */}
      <View style={{ paddingLeft: 22, paddingRight: 22, paddingTop: gap }}>
        <PdfItemsTable items={data.items} cfg={cfg} font={font} bold={bold} darkMode={true} />
        {/* Dark totals */}
        <View style={{ marginTop: gap, flexDirection: "row", justifyContent: "flex-end" }}>
          <View style={{ minWidth: 160 }}>
            {cfg.showTax && (data.taxAmt ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={{ fontSize: 8.5, color: "#64748b", fontFamily: font }}>{data.taxLabel ?? "Tax"}</Text>
                <Text style={{ fontSize: 8.5, color: "#64748b", fontFamily: font }}>{fmtAmt(data.taxAmt, data.currency)}</Text>
              </View>
            )}
            {cfg.showDiscount && (data.discount ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={{ fontSize: 8.5, color: "#4ade80", fontFamily: font }}>Discount</Text>
                <Text style={{ fontSize: 8.5, color: "#4ade80", fontFamily: font }}>-{fmtAmt(data.discount, data.currency)}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: hexAlpha(accent, 0.31), paddingTop: 5, marginTop: 3 }}>
              <Text style={{ fontSize: 12, fontFamily: bold, color: "#f8fafc" }}>Total</Text>
              <Text style={{ fontSize: 12, fontFamily: bold, color: accent }}>{fmtAmt(data.total, data.currency)}</Text>
            </View>
            {data.type === "invoice" && (data.outstanding ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                <Text style={{ fontSize: 8.5, color: "#f87171", fontFamily: font }}>Outstanding</Text>
                <Text style={{ fontSize: 8.5, color: "#f87171", fontFamily: font }}>{fmtAmt(data.outstanding, data.currency)}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ marginTop: gap }}>
          <PdfRemarks remarks={data.remarks} accent={accent} textColor="#94a3b8" font={font} />
        </View>
      </View>
      {/* Footer */}
      <View style={{ marginLeft: 22, marginRight: 22, marginTop: gap }}>
        <PdfFooter cfg={cfg} data={data} borderColor="rgba(255,255,255,0.08)" textColor="#475569" font={font} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 5 — Bold Accent
// ═══════════════════════════════════════════════════════════════════════════════
function BoldAccentPDF({ cfg, data, font, bold }: { cfg: Cfg; data: DocData; font: string; bold: string }) {
  const accent = cfg.accentColor ?? "#f97316";
  const mainTc = cfg.headerTextColor || "#111111";
  const gap = cfg.contentGap ?? 12;
  const dueLabel = data.type === "quotation" ? "Valid Until:" : "Due:";

  return (
    <View style={{ backgroundColor: "#ffffff", flex: 1, flexDirection: "row" }}>
      {/* Left accent bar */}
      <View style={{ width: 5, backgroundColor: accent }} />
      {/* Content */}
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingTop: 20, paddingBottom: 12, paddingLeft: 22, paddingRight: 22, borderBottomWidth: 2, borderBottomColor: accent }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={{ fontSize: 16, fontFamily: bold, color: mainTc, letterSpacing: -0.1, marginBottom: 2 }}>{data.companyName ?? "Your Company"}</Text>
              {cfg.showAddress && data.companyAddress && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font, marginTop: 2 }}>{data.companyAddress}</Text>}
              {cfg.showPhone && data.companyPhone && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>{data.companyPhone}</Text>}
              {data.companyEmail && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>{data.companyEmail}</Text>}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 9, fontFamily: bold, color: accent, textTransform: "uppercase", letterSpacing: 1 }}>
                {data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT"}
              </Text>
              <Text style={{ fontSize: 20, fontFamily: bold, color: mainTc, letterSpacing: -0.2 }}>{data.docNo}</Text>
              <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>{fmtDate(data.issueDate)}</Text>
              {data.dueDate && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>Due {fmtDate(data.dueDate)}</Text>}
            </View>
          </View>
        </View>
        {/* Meta */}
        {data.type !== "receipt" && (
          <View style={{ flexDirection: "row", paddingTop: 10, paddingBottom: 10, paddingLeft: 22, paddingRight: 22, borderBottomWidth: 1, borderBottomColor: hexAlpha(accent, 0.13) }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", color: accent, letterSpacing: 1, marginBottom: 4 }}>Bill To</Text>
              <Text style={{ fontSize: 10, fontFamily: bold, color: "#111111", marginBottom: 2 }}>{data.customer.name ?? "—"}</Text>
              {data.customer.company && <Text style={{ fontSize: 8, color: "#666666", fontFamily: font }}>{data.customer.company}</Text>}
              {data.customer.phone && <Text style={{ fontSize: 8, color: "#666666", fontFamily: font }}>{data.customer.phone}</Text>}
              {data.customer.address && <Text style={{ fontSize: 8, color: "#888888", fontFamily: font, marginTop: 2 }}>{data.customer.address}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", color: accent, letterSpacing: 1, marginBottom: 4 }}>Details</Text>
              <Text style={{ fontSize: 8, color: "#555555", fontFamily: font, marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</Text>
              {data.dueDate && <Text style={{ fontSize: 8, color: "#555555", fontFamily: font }}>{dueLabel} {fmtDate(data.dueDate)}</Text>}
              <Text style={{ fontSize: 8, color: "#888888", fontFamily: font }}>Currency: {data.currency ?? "PKR"}</Text>
            </View>
          </View>
        )}
        {/* Items */}
        <View style={{ paddingLeft: 22, paddingRight: 22, paddingTop: gap }}>
          <PdfItemsTable items={data.items} cfg={cfg} font={font} bold={bold} />
          <PdfTotalsBlock data={data} cfg={cfg} font={font} bold={bold} />
          <View style={{ marginTop: gap }}>
            <PdfRemarks remarks={data.remarks} accent={accent} textColor="#555555" font={font} />
          </View>
        </View>
        {/* Footer */}
        <View style={{ marginLeft: 22, marginRight: 22, marginTop: gap }}>
          <PdfFooter cfg={cfg} data={data} borderColor={accent} textColor="#888888" font={font} />
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 6 — Retro Serif
// ═══════════════════════════════════════════════════════════════════════════════
function RetroSerifPDF({ cfg, data, font, bold }: { cfg: Cfg; data: DocData; font: string; bold: string }) {
  const accent = cfg.accentColor ?? "#8b4513";
  const mainTc = cfg.headerTextColor || accent;
  const subTc = "#7c5533";
  const gap = cfg.contentGap ?? 12;
  const dueLabel = data.type === "quotation" ? "Valid Until:" : "Due:";

  return (
    <View style={{ backgroundColor: "#faf7f0", flex: 1, padding: 16 }}>
      {/* Outer border */}
      <View style={{ borderWidth: 2, borderColor: accent, flex: 1 }}>
        {/* Inner border */}
        <View style={{ borderWidth: 0.5, borderColor: hexAlpha(accent, 0.38), margin: 4, flex: 1, paddingTop: 14, paddingBottom: 14, paddingLeft: 18, paddingRight: 18 }}>
          {/* Centered header */}
          <View style={{ alignItems: "center", borderBottomWidth: 1, borderBottomColor: hexAlpha(accent, 0.25), paddingBottom: 12, marginBottom: gap }}>
            <Text style={{ fontSize: 18, fontFamily: bold, color: mainTc, letterSpacing: 0.4, marginBottom: 2 }}>{data.companyName ?? "Your Company"}</Text>
            {cfg.showAddress && data.companyAddress && <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 2 }}>{data.companyAddress}</Text>}
            {cfg.showPhone && data.companyPhone && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyPhone}</Text>}
            {data.companyEmail && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.companyEmail}</Text>}
          </View>
          {/* Type label + number */}
          <View style={{ alignItems: "center", marginBottom: gap }}>
            <Text style={{ fontSize: 13, fontFamily: bold, letterSpacing: 2, textTransform: "uppercase", color: accent, borderTopWidth: 0.5, borderTopColor: hexAlpha(accent, 0.25), borderBottomWidth: 0.5, borderBottomColor: hexAlpha(accent, 0.25), paddingTop: 4, paddingBottom: 4, paddingLeft: 12, paddingRight: 12 }}>
              {data.type === "invoice" ? "INVOICE" : data.type === "quotation" ? "QUOTATION" : "RECEIPT"}
            </Text>
            <Text style={{ fontSize: 10, color: subTc, fontFamily: font, marginTop: 4, fontStyle: "italic" }}>No. {data.docNo}</Text>
            <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>
              Issued: {fmtDate(data.issueDate)}{data.dueDate ? ` · Due: ${fmtDate(data.dueDate)}` : ""}
            </Text>
          </View>
          {/* Meta */}
          {data.type !== "receipt" && (
            <View style={{ flexDirection: "row", marginBottom: gap, borderBottomWidth: 0.5, borderBottomColor: hexAlpha(accent, 0.19), paddingBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 1, color: accent, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: 10, fontFamily: bold, color: "#2d1b00", marginBottom: 2 }}>{data.customer.name ?? "—"}</Text>
                {data.customer.company && <Text style={{ fontSize: 8, color: subTc, fontFamily: font, fontStyle: "italic" }}>{data.customer.company}</Text>}
                {data.customer.phone && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{data.customer.phone}</Text>}
                {data.customer.address && <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginTop: 2 }}>{data.customer.address}</Text>}
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={{ fontSize: 7, fontFamily: bold, textTransform: "uppercase", letterSpacing: 1, color: accent, marginBottom: 4 }}>Document</Text>
                <Text style={{ fontSize: 8, color: subTc, fontFamily: font, marginBottom: 2 }}>Date: {fmtDate(data.issueDate)}</Text>
                {data.dueDate && <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>{dueLabel} {fmtDate(data.dueDate)}</Text>}
                <Text style={{ fontSize: 8, color: subTc, fontFamily: font }}>Currency: {data.currency ?? "PKR"}</Text>
              </View>
            </View>
          )}
          {/* Items */}
          <PdfItemsTable items={data.items} cfg={cfg} font={font} bold={bold} />
          <PdfTotalsBlock data={data} cfg={cfg} font={font} bold={bold} />
          <View style={{ marginTop: gap }}>
            <PdfRemarks remarks={data.remarks} accent={accent} textColor={subTc} font={font} />
          </View>
          {/* Footer */}
          <PdfFooter cfg={cfg} data={data} borderColor={hexAlpha(accent, 0.25)} textColor={accent} font={font} italic={true} />
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main document
// ═══════════════════════════════════════════════════════════════════════════════
export function DocumentPDF({ design, data }: { design: DocumentDesign; data: DocData }) {
  const cfg = resolveConfig(design);
  const preset = cfg.preset ?? "modern-gradient";
  const font = getPdfFont(cfg.fontFamily ?? "");
  const bold = boldOf(font);

  console.log("[PDF] DocumentPDF rendering:", {
    preset,
    font,
    bold,
    headerBg: cfg.headerBg,
    headerBgSolid: extractSolid(cfg.headerBg ?? ""),
    accentColor: cfg.accentColor,
    fontFamily: cfg.fontFamily,
    tableStyle: cfg.tableStyle,
    pageSize: cfg.pageSize,
    itemCount: data.items?.length ?? 0,
    total: data.total,
    customerName: data.customer?.name,
  });

  const pageBg =
    preset === "executive-dark" ? "#1e293b" :
    preset === "retro-serif" ? "#faf7f0" : "#ffffff";

  const templateProps = { cfg, data, font, bold };

  return (
    <Document>
      <Page
        size={(cfg.pageSize as any) ?? "A4"}
        orientation={(cfg.pageOrientation as any) ?? "portrait"}
        style={{ fontFamily: font, fontSize: 9, backgroundColor: pageBg, flexDirection: "column" }}
      >
        {preset === "classic-corporate" && <ClassicPDF {...templateProps} />}
        {preset === "modern-gradient" && <ModernGradientPDF {...templateProps} />}
        {preset === "minimal-clean" && <MinimalPDF {...templateProps} />}
        {preset === "executive-dark" && <ExecutiveDarkPDF {...templateProps} />}
        {preset === "bold-accent" && <BoldAccentPDF {...templateProps} />}
        {preset === "retro-serif" && <RetroSerifPDF {...templateProps} />}
        {/* Fallback for custom designs */}
        {!["classic-corporate","modern-gradient","minimal-clean","executive-dark","bold-accent","retro-serif"].includes(preset) && (
          <ModernGradientPDF {...templateProps} />
        )}
      </Page>
    </Document>
  );
}

// ─── Blob helper (used for WhatsApp PDF attachment) ────────────────────────────
export async function generatePdfBlob(design: DocumentDesign, data: DocData): Promise<Blob> {
  return pdf(<DocumentPDF design={design} data={data} />).toBlob();
}

// ─── Download helper ───────────────────────────────────────────────────────────
export async function downloadAsPdf(
  design: DocumentDesign,
  data: DocData,
  fileName: string
): Promise<void> {
  const cfg = resolveConfig(design);
  console.log("[PDF] downloadAsPdf called:", {
    designId: design.id,
    designName: design.name,
    preset: cfg.preset,
    headerBg: cfg.headerBg,
    accentColor: cfg.accentColor,
    fontFamily: cfg.fontFamily,
    tableStyle: cfg.tableStyle,
    docType: data.type,
    docNo: data.docNo,
    itemCount: data.items?.length ?? 0,
    total: data.total,
    customerName: data.customer?.name,
  });

  try {
    const element = <DocumentPDF design={design} data={data} />;
    console.log("[PDF] Creating PDF instance...");
    const instance = pdf(element);
    console.log("[PDF] Converting to blob...");
    const blob = await instance.toBlob();
    console.log("[PDF] Blob generated, size:", blob.size, "type:", blob.type);
    const name = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const file = new File([blob], name, { type: "application/pdf" });
    downloadFile(file);
    console.log("[PDF] Download triggered for:", name);
  } catch (err) {
    console.error("[PDF] ERROR during PDF generation:", err);
    if (err instanceof Error) {
      console.error("[PDF] Error message:", err.message);
      console.error("[PDF] Error stack:", err.stack);
    }
    throw err;
  }
}
