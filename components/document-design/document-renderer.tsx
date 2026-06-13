"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { resolveConfig } from "@/lib/document-designs";
import type { DocumentDesign, RichTextContent } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { renderRichText, isEmptyRichText } from "@/lib/rich-text/render";

export interface DocumentData {
  type: "invoice" | "quotation" | "receipt";
  docNo?: string;
  issueDate?: string;
  dueDate?: string;
  customer?: { name?: string; phone?: string; address?: string; company?: string };
  items?: Array<{ name: string; description?: RichTextContent; quantity: number; price: number; images?: string[] }>;
  subTotal?: number;
  taxAmt?: number;
  taxLabel?: string;
  discount?: number;
  delivery?: number;
  total?: number;
  advance?: number;
  outstanding?: number;
  currency?: string;
  remarks?: RichTextContent;
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
  /** Display width in px. Default: 595 (A4 natural). */
  width?: number;
  /** Natural page height in pt for page-break calculation. Default: 842 (A4). */
  pageHeight?: number;
  /** Show visual page-break dividers in the preview. Default: false. */
  showPageBreaks?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "INVOICE",
  quotation: "QUOTATION",
  receipt: "RECEIPT",
};

export function DocumentRenderer({ design, data, width = 595, pageHeight = 842, showPageBreaks = false }: Props) {
  const [naturalH, setNaturalH] = useState(data.type === "receipt" ? 420 : 1100);

  // Callback ref fires whenever the measured element mounts, unmounts, or is
  // swapped (e.g. when showPageBreaks toggles and the ref switches between the
  // multi-page window and the single-scroll wrapper). Using useState+useCallback
  // instead of useRef lets us put measureEl in effect dependency arrays so the
  // effects re-run automatically when the element changes.
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => setMeasureEl(el), []);

  // Page-break offsets (unscaled px, each value = where a page ENDS) computed at
  // element boundaries so a row/section is never split across pages. Empty until measured.
  const [pageBreaks, setPageBreaks] = useState<number[]>([]);

  // Measured heights (in 595-design units) of the header + footer bands, so each
  // can be repeated per page (per cfg.headerVisibility / cfg.footerVisibility) in
  // the multi-page view, with the body paginating through the space between them.
  const [headerH, setHeaderH] = useState(0);
  const [footerH, setFooterH] = useState(0);

  // Preset key (stable string) — used by the page-break effect to reserve the
  // footer's bottom inset for framed designs so the last row never clips.
  const presetKey = design.config?.preset ?? "modern-gradient";

  // Synchronous initial measurement so numPages is correct before first paint.
  // Runs whenever the measured element is swapped — no [] stale-element bug.
  useLayoutEffect(() => {
    if (measureEl) setNaturalH(measureEl.offsetHeight);
  }, [measureEl]);

  // Track all subsequent height changes (items added, config changes, etc.).
  // ResizeObserver fires asynchronously — cannot cause infinite update loop.
  // Re-attaches when the measured element is swapped.
  useEffect(() => {
    if (!measureEl) return;
    const ro = new ResizeObserver(() => setNaturalH(measureEl.offsetHeight));
    ro.observe(measureEl);
    return () => ro.disconnect();
  }, [measureEl]);

  // Measure the repeated-header band + compute body page boundaries. The header
  // (tagged [data-doc-header]) is repeated atop every page that shows it, so the
  // body paginates through the REMAINING space (pageHeight − headerHeight).
  // Boundaries fall at [data-break-block] edges so a row/section is never split
  // (mirrors the PDF, whose item rows use wrap={false}). The header height is read
  // from the DOM here (not from state) so the boundaries are correct on the first
  // pass. Re-runs when content height changes.
  useLayoutEffect(() => {
    if (!showPageBreaks || !measureEl) { setPageBreaks([]); setHeaderH(0); setFooterH(0); return; }
    const sc = width / 595;
    const baseTop = measureEl.getBoundingClientRect().top;
    const total = measureEl.offsetHeight; // unscaled (offsetHeight ignores CSS transform)
    const headerEl = measureEl.querySelector<HTMLElement>("[data-doc-header]");
    const hH = headerEl
      ? Math.max(0, (headerEl.getBoundingClientRect().bottom - baseTop) / sc)
      : 0;
    const footerEl = measureEl.querySelector<HTMLElement>("[data-doc-footer]");
    const fRect = footerEl?.getBoundingClientRect();
    const fH = fRect ? fRect.height / sc : 0;
    const fTop = fRect ? (fRect.top - baseTop) / sc : total; // body content ends here; footer repeats separately
    const fInset = pageChromeFor(presetKey).footerBottom; // bottom gap reserved for framed designs
    const usable = Math.max(120, pageHeight - hH - fH - fInset); // body space per page between header & footer
    const blocks = Array.from(measureEl.querySelectorAll<HTMLElement>("[data-break-block]"));
    const boundaries: number[] = [];
    let pageStart = hH; // first page's body begins just below the header band
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      const top = (r.top - baseTop) / sc;
      const bottom = (r.bottom - baseTop) / sc;
      if (bottom <= hH + 0.5) continue; // inside the header band
      if (top >= fTop - 0.5) continue;  // the footer (repeated separately) and anything after it
      // Break before this block if it would overflow the current page's body area
      // AND the page already has body content — avoids an empty leading page.
      if (bottom - pageStart > usable && top > pageStart + 1) {
        boundaries.push(top);
        pageStart = top;
      }
    }
    boundaries.push(fTop); // body ends where the footer band begins
    setHeaderH(hH);
    setFooterH(fH);
    setPageBreaks(prev =>
      prev.length === boundaries.length && prev.every((v, i) => Math.abs(v - boundaries[i]) < 0.5)
        ? prev
        : boundaries
    );
  }, [showPageBreaks, measureEl, width, pageHeight, naturalH, presetKey]);

  const cfg = resolveConfig(design);
  const preset = cfg.preset ?? "modern-gradient";
  const currency = data.currency ?? "PKR";
  const fmt = (n?: number) => formatCurrency(n ?? 0, currency);
  const fmtDate = (d?: string) => d ? formatDate(new Date(d)) : "—";
  const typeLabel = TYPE_LABELS[data.type] ?? "DOCUMENT";
  const docNo = data.docNo ?? "—";
  const companyName = data.companyName ?? "Your Company";
  const scale = width / 595;
  const templateProps: TemplateProps = { cfg, data, typeLabel, docNo, companyName, fmt, fmtDate };

  // Returns template JSX for a given page. Call with different pageIndex for each page window.
  const renderTemplate = (pageIndex = 0, totalPages = 1) => (
    <>
      {preset === "classic-corporate" && <ClassicDoc {...templateProps} pageIndex={pageIndex} totalPages={totalPages} />}
      {preset === "modern-gradient" && <ModernGradientDoc {...templateProps} pageIndex={pageIndex} totalPages={totalPages} />}
      {preset === "minimal-clean" && <MinimalDoc {...templateProps} pageIndex={pageIndex} totalPages={totalPages} />}
      {preset === "executive-dark" && <ExecutiveDarkDoc {...templateProps} pageIndex={pageIndex} totalPages={totalPages} />}
      {preset === "bold-accent" && <BoldAccentDoc {...templateProps} pageIndex={pageIndex} totalPages={totalPages} />}
      {preset === "retro-serif" && <RetroSerifDoc {...templateProps} pageIndex={pageIndex} totalPages={totalPages} />}
      {cfg.watermark && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%) rotate(-35deg)",
          fontSize: 72, fontWeight: 800, opacity: 0.06,
          color: "#000", pointerEvents: "none", whiteSpace: "nowrap",
          zIndex: 10, userSelect: "none",
        }}>{cfg.watermark}</div>
      )}
    </>
  );

  const scaledPageH = Math.round(pageHeight * scale);
  const chrome = pageChromeFor(preset); // full-page bg + frame/bar so the design fills the whole sheet
  const usableBody = Math.max(120, pageHeight - headerH - footerH - chrome.footerBottom); // body space per page between header & footer
  const numPages = showPageBreaks
    ? (pageBreaks.length > 0 ? pageBreaks.length : Math.max(1, Math.ceil(Math.max(1, naturalH - headerH - footerH - chrome.footerBottom) / usableBody)))
    : 1;

  // Which pages show the repeated header (per cfg.headerVisibility). The header
  // band is always present in renderTemplate(0, 1) — page 0 of 1 satisfies every
  // visibility rule — so it can be clipped out and repeated per page here.
  const headerVis = cfg.headerVisibility ?? "all";
  const headerEnabled = cfg.headerEnabled !== false;
  const headerOnPage = (i: number) =>
    headerH > 0 && headerEnabled &&
    (headerVis === "first" ? i === 0
      : headerVis === "last" ? i === numPages - 1
      : headerVis === "first-last" ? (i === 0 || i === numPages - 1)
      : true); // "all" / default → every page

  // Which pages show the repeated footer (per cfg.footerVisibility). Unlike the
  // clipped header, the footer is re-rendered per page so its page number + terms
  // are correct for that page; styling comes from footerStyleFor(preset).
  const footerVis = cfg.footerVisibility ?? "all";
  const footerEnabled = cfg.footerEnabled !== false;
  const footerOnPage = (i: number) =>
    footerH > 0 && footerEnabled &&
    (footerVis === "first" ? i === 0
      : footerVis === "last" ? i === numPages - 1
      : footerVis === "first-last" ? (i === 0 || i === numPages - 1)
      : true); // "all" / default → every page
  const accent = cfg.accentColor ?? "#6366f1";
  const footerStyle = footerStyleFor(preset, accent);

  // ── Multi-page view ──────────────────────────────────────────────────────────
  //
  // HOW IT WORKS (a real paginated document):
  //   • Page chrome — the design's page background + (retro frame / bold bar) at
  //     FULL page height, behind everything, so the sheet is filled even when the
  //     content is short.
  //   • Header layer — clips the document to its header band [0 … headerH] and
  //     pins it to the top of every page that should show it.
  //   • Body layer — clips the document to THIS page's body slice (between the
  //     header and footer bands). Clipped to the SLICE height (not the leftover
  //     space) so the document's inline footer can never leak through underneath.
  //   • Footer layer — a fresh <DocFooter> for THIS page (correct page number +
  //     per-page terms), pinned near the bottom (inside the frame for framed
  //     designs), on every page that shows it.
  // "Show header/footer on: Every page / First / Last / First & last" all apply.
  if (showPageBreaks) {
    const bodyStartOf = (i: number) => (i === 0 ? headerH : (pageBreaks[i - 1] ?? headerH + i * usableBody));
    const bodyEndOf = (i: number) => (pageBreaks[i] ?? headerH + (i + 1) * usableBody);
    return (
      <div>
        {Array.from({ length: numPages }).map((_, i) => {
          const showHdr = headerOnPage(i);
          const showFtr = footerOnPage(i);
          const hOff = showHdr ? Math.round(headerH * scale) : 0;
          const fOff = showFtr ? Math.round(footerH * scale) : 0;
          const fBottom = showFtr ? Math.round(chrome.footerBottom * scale) : 0;
          const bStart = bodyStartOf(i);
          const bodySliceH = Math.max(0, Math.round((bodyEndOf(i) - bStart) * scale));
          const bodyH = Math.min(bodySliceH, Math.max(0, scaledPageH - hOff - fOff - fBottom));
          return (
          <div key={i}>
            {i > 0 && (
              <div style={{
                height: 20, display: "flex", alignItems: "center",
                padding: "0 10px", gap: 10, background: "rgba(10,14,28,0.92)",
              }}>
                <div style={{ flex: 1, height: "0.5px", background: "rgba(99,102,241,0.4)" }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: "rgba(129,140,248,0.8)", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                  PAGE {i + 1} / {numPages}
                </span>
                <div style={{ flex: 1, height: "0.5px", background: "rgba(99,102,241,0.4)" }} />
              </div>
            )}
            {/* Full sheet — filled with the design's page background */}
            <div style={{ width, height: scaledPageH, overflow: "hidden", position: "relative", background: chrome.bg }}>
              {/* Full-page chrome (retro frame / bold bar) behind the content */}
              {(chrome.frame || chrome.leftBar) && (
                <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                  <div style={{ width: 595, height: pageHeight, transformOrigin: "top left", transform: `scale(${scale})`, position: "relative" }}>
                    {chrome.leftBar && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 5, background: accent }} />}
                    {chrome.frame && (<>
                      <div style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: `2px solid ${accent}`, borderRadius: 2 }} />
                      <div style={{ position: "absolute", top: 36, left: 40, right: 40, bottom: 36, border: `0.5px solid ${accent}60`, borderRadius: 1 }} />
                    </>)}
                  </div>
                </div>
              )}
              {/* Repeated header band, pinned to the top of this page */}
              {showHdr && (
                <div style={{ position: "absolute", top: 0, left: 0, width, height: hOff, overflow: "hidden" }}>
                  <div style={{ width: 595, transformOrigin: "top left", transform: `scale(${scale})`, fontFamily: cfg.fontFamily }}>
                    {renderTemplate(0, 1)}
                  </div>
                </div>
              )}
              {/* Body slice for this page — clipped to the slice height (no inline-footer leak) */}
              <div style={{ position: "absolute", top: hOff, left: 0, width, height: bodyH, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -(bStart * scale), left: 0 }}>
                  <div
                    ref={i === 0 ? measureRef : undefined}
                    style={{
                      width: 595, transformOrigin: "top left",
                      transform: `scale(${scale})`,
                      fontFamily: cfg.fontFamily, position: "relative",
                    }}
                  >
                    {renderTemplate(0, 1)}
                  </div>
                </div>
              </div>
              {/* Repeated footer band — fresh per page, pinned near the bottom */}
              {showFtr && (
                <div style={{ position: "absolute", bottom: fBottom, left: 0, width, height: fOff, overflow: "hidden" }}>
                  <div style={{ width: 595, transformOrigin: "top left", transform: `scale(${scale})`, fontFamily: cfg.fontFamily }}>
                    <DocFooter cfg={cfg} data={data} {...footerStyle} pageIndex={i} totalPages={numPages} />
                  </div>
                </div>
              )}
              {/* Page number badge — shows the correct page for this viewport */}
              <div style={{
                position: "absolute", bottom: 6, right: 8,
                fontSize: 8, color: "rgba(0,0,0,0.22)", userSelect: "none", pointerEvents: "none",
              }}>
                {i + 1} / {numPages}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    );
  }

  // ── Single-scroll view (default) ─────────────────────────────────────────────
  return (
    <div style={{ width, height: naturalH * scale, overflow: "hidden", position: "relative" }}>
      <div ref={measureRef} style={{
        width: 595,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        fontFamily: cfg.fontFamily,
        position: "relative",
      }}>
        {renderTemplate(0, 1)}
      </div>
    </div>
  );
}

// ─── Standalone full-width template (for the print route / PDF) ─────────────────
// Renders the chosen design's template at natural 595px width with NO scale
// transform and NO JS page-slicing — the SAME template functions the preview
// uses. The print route (components/document-design/print-document.tsx) wraps
// this with `zoom` to fill A4 and lets real CSS handle pagination, so the
// exported PDF is pixel-identical to the on-screen preview.
export function DocumentTemplate({ design, data }: { design: DocumentDesign; data: DocumentData }) {
  const cfg = resolveConfig(design);
  const preset = cfg.preset ?? "modern-gradient";
  const currency = data.currency ?? "PKR";
  const fmt = (n?: number) => formatCurrency(n ?? 0, currency);
  const fmtDate = (d?: string) => (d ? formatDate(new Date(d)) : "—");
  const typeLabel = TYPE_LABELS[data.type] ?? "DOCUMENT";
  const docNo = data.docNo ?? "—";
  const companyName = data.companyName ?? "Your Company";
  const templateProps: TemplateProps = { cfg, data, typeLabel, docNo, companyName, fmt, fmtDate };
  const known = ["classic-corporate", "modern-gradient", "minimal-clean", "executive-dark", "bold-accent", "retro-serif"];
  return (
    <div style={{ width: 595, position: "relative", fontFamily: cfg.fontFamily }}>
      {preset === "classic-corporate" && <ClassicDoc {...templateProps} pageIndex={0} totalPages={1} />}
      {preset === "modern-gradient" && <ModernGradientDoc {...templateProps} pageIndex={0} totalPages={1} />}
      {preset === "minimal-clean" && <MinimalDoc {...templateProps} pageIndex={0} totalPages={1} />}
      {preset === "executive-dark" && <ExecutiveDarkDoc {...templateProps} pageIndex={0} totalPages={1} />}
      {preset === "bold-accent" && <BoldAccentDoc {...templateProps} pageIndex={0} totalPages={1} />}
      {preset === "retro-serif" && <RetroSerifDoc {...templateProps} pageIndex={0} totalPages={1} />}
      {!known.includes(preset) && <ModernGradientDoc {...templateProps} pageIndex={0} totalPages={1} />}
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
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function FormattedTerms({ text, color, fontStyle, format }: {
  text: string;
  color: string;
  fontStyle?: string;
  format: "paragraph" | "bullet" | "numbered";
}) {
  const base: React.CSSProperties = { fontSize: 7.5, color, lineHeight: 1.5, fontStyle };
  if (format === "paragraph") return <div style={base}>{text}</div>;
  const lines = text.split("\n").filter(l => l.trim());
  if (format === "bullet") {
    return (
      <ul style={{ ...base, paddingLeft: 14, margin: 0, listStyleType: "disc", listStylePosition: "outside" }}>
        {lines.map((l, i) => <li key={i} style={{ marginBottom: 2 }}>{l.trim()}</li>)}
      </ul>
    );
  }
  return (
    <ol style={{ ...base, paddingLeft: 16, margin: 0, listStyleType: "decimal", listStylePosition: "outside" }}>
      {lines.map((l, i) => <li key={i} style={{ marginBottom: 2 }}>{l.trim()}</li>)}
    </ol>
  );
}

// Per-preset footer styling, mirroring each template's inline <DocFooter> args
// (cfg.accentColor/contentGap are always resolved, so the templates' `?? default`
// is dead code and these match exactly). The top margin is dropped because the
// multi-page preview pins the footer to the page bottom in its own layer.
function footerStyleFor(preset: string, accent: string): {
  borderStyle: string; defaultTextColor: string; fontStyle?: string; margin?: string;
} {
  switch (preset) {
    case "classic-corporate": return { borderStyle: `1px solid ${accent}40`, defaultTextColor: "#888", margin: "0 24px 0" };
    case "minimal-clean":     return { borderStyle: "0.5px solid #d1d5db", defaultTextColor: "#9ca3af", margin: "0" };
    case "executive-dark":    return { borderStyle: "0.5px solid rgba(255,255,255,0.08)", defaultTextColor: "#475569", margin: "0 22px 0" };
    case "bold-accent":       return { borderStyle: `2px solid ${accent}`, defaultTextColor: "#888", margin: "0 22px 0 27px" }; // clears the 5px left bar
    case "retro-serif":       return { borderStyle: `0.5px solid ${accent}40`, defaultTextColor: accent, fontStyle: "italic", margin: "0 59px 0" }; // sits inside the double frame
    case "modern-gradient":
    default:                  return { borderStyle: `1.5px solid ${accent}`, defaultTextColor: "#888", margin: "0 16px 0" };
  }
}

// Full-page "page chrome" so the design fills the WHOLE sheet (not just the
// content). bg is the design's page colour; frame/leftBar reproduce the retro
// double border + bold left accent bar at full page height, behind the content.
// footerBottom insets the pinned footer so framed designs keep it inside the frame.
function pageChromeFor(preset: string): { bg: string; frame?: boolean; leftBar?: boolean; footerBottom: number } {
  switch (preset) {
    case "executive-dark": return { bg: "#1e293b", footerBottom: 0 };
    case "retro-serif":    return { bg: "#faf7f0", frame: true, footerBottom: 36 };
    case "bold-accent":    return { bg: "#fff", leftBar: true, footerBottom: 0 };
    default:               return { bg: "#fff", footerBottom: 0 };
  }
}

function DocFooter({ cfg, data, borderStyle, defaultTextColor, fontStyle, margin, pageIndex = 0, totalPages = 1 }: {
  cfg: ReturnType<typeof resolveConfig>;
  data: DocumentData;
  borderStyle: string;
  defaultTextColor: string;
  fontStyle?: string;
  margin?: string;
  pageIndex?: number;
  totalPages?: number;
}) {
  if (cfg.footerEnabled === false) return null;
  const tc = cfg.footerTextColor || defaultTextColor;
  const fmt = (cfg.termsFormat ?? "paragraph") as "paragraph" | "bullet" | "numbered";
  const pos = cfg.termsPosition ?? "end";

  // Determine whether terms should appear in the footer for this page
  const showTermsHere = cfg.showTerms && (() => {
    if (pos === "start") return false;                                              // only before items
    if (pos === "end") return pageIndex === totalPages - 1;                        // last page only
    if (pos === "every") return true;                                              // every page
    if (pos === "first-last") return pageIndex === 0 || pageIndex === totalPages - 1;
    if (pos === "start-every") return true;                                        // at start + every page footer
    if (pos === "end-every") return true;                                          // every page footer
    return false;
  })();

  const resolvedTermsText = cfg.termsText || data.termsText;
  const hasTerms = showTermsHere && !!resolvedTermsText;
  return (
    <div data-break-block="" data-doc-footer="" style={{
      borderTop: borderStyle, marginTop: 12, paddingTop: 8, paddingBottom: 8,
      background: cfg.footerBg || undefined,
      ...(margin ? { margin } : {}),
    }}>
      {hasTerms && (
        <div style={{ marginBottom: 6 }}>
          <FormattedTerms text={resolvedTermsText!} color={tc} fontStyle={fontStyle} format={fmt} />
        </div>
      )}
      <div style={{ display: "flex", justifyContent: cfg.showPageNumber ? "space-between" : "center", alignItems: "center" }}>
        <div style={{ fontSize: 7.5, color: tc, textAlign: cfg.showPageNumber ? "left" : "center", flex: 1, fontStyle }}>
          {cfg.footerText || "Thank you for your business."}
        </div>
        {cfg.showPageNumber && (
          <div style={{ fontSize: 7.5, color: tc, flexShrink: 0, fontStyle }}>
            Page {pageIndex + 1}{totalPages > 1 ? ` of ${totalPages}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemsTable({ items, cfg, fmt }: {
  items: DocumentData["items"];
  cfg: ReturnType<typeof resolveConfig>;
  fmt: (n?: number) => string;
}) {
  const accentColor = cfg.accentColor ?? "#6366f1";
  const tableStyle = cfg.tableStyle ?? "striped";
  const displayItems = (items ?? []).filter(i => i.name);
  const hasImages = displayItems.some(i => i.images?.length);

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
          <th style={{ ...thStyle, width: 20, padding: "6px 4px", textAlign: "center" as const }}>#</th>
          {hasImages && <th style={{ ...thStyle, width: 38, padding: "6px 6px" }} />}
          <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
          <th style={{ ...thStyle, textAlign: "right", width: 40 }}>Qty</th>
          <th style={{ ...thStyle, textAlign: "right", width: 80 }}>Rate</th>
          <th style={{ ...thStyle, textAlign: "right", width: 80 }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {displayItems.length === 0 ? (
          <tr>
            <td colSpan={hasImages ? 6 : 5} style={{ padding: "12px 10px", textAlign: "center", color: "#999", fontSize: 8.5 }}>
              Add line items to see them here
            </td>
          </tr>
        ) : displayItems.map((item, idx) => {
          let rowBg = "transparent";
          if (tableStyle === "striped") rowBg = idx % 2 === 1 ? `${accentColor}08` : "transparent";
          const cellBorder = tableStyle === "bordered" ? `0.5px solid ${accentColor}30` : tableStyle === "striped" ? "0.5px solid rgba(0,0,0,0.05)" : "none";
          return (
            <tr key={idx} data-break-block="" style={{ background: rowBg }}>
              <td style={{ padding: "6px 4px", borderBottom: cellBorder, borderRight: tableStyle === "bordered" ? cellBorder : "none", color: "#888", textAlign: "center", fontSize: 8 }}>{idx + 1}</td>
              {hasImages && (
                <td style={{ padding: "4px 6px", borderBottom: cellBorder, borderRight: tableStyle === "bordered" ? cellBorder : "none", verticalAlign: "middle" }}>
                  {item.images?.[0] && <img src={item.images[0]} alt={item.name} style={{ width: 30, height: 30, objectFit: "cover", borderRadius: 3, display: "block" }} />}
                </td>
              )}
              <td style={{ padding: "6px 10px", borderBottom: cellBorder, borderRight: tableStyle === "bordered" ? cellBorder : "none", color: "#222", fontSize: 9, overflowWrap: "anywhere" as const }}>
                {item.name}
                {(() => {
                  const descHtml = renderRichText(item.description);
                  return descHtml ? (
                    <div className="qs-rich" style={{ marginTop: 2, fontSize: 8, color: "#555", lineHeight: 1.45 }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: descHtml }} />
                  ) : null;
                })()}
              </td>
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
    <div data-break-block="" style={{ display: "flex", justifyContent: "flex-end", padding: "10px 12px 0" }}>
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

// ─── Remarks / notes block ────────────────────────────────────────────────────
function RemarksBlock({ remarks, accentColor, textColor = "#555" }: { remarks?: RichTextContent; accentColor: string; textColor?: string }) {
  if (isEmptyRichText(remarks)) return null;
  const html = renderRichText(remarks);
  if (!html) return null;
  return (
    <div data-break-block="" style={{ margin: "8px 0 0", padding: "7px 10px", background: `${accentColor}0A`, borderLeft: `2px solid ${accentColor}40`, borderRadius: "0 4px 4px 0" }}>
      <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase" as const, color: accentColor, letterSpacing: "0.08em", marginBottom: 3 }}>Notes</div>
      <div className="qs-rich" style={{ fontSize: 8, color: textColor, lineHeight: 1.5 }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ─── Attachments section (appended after totals for items with images) ────────
function AttachmentsSection({ items, cfg, textColor = "#555" }: {
  items: DocumentData["items"];
  cfg: ReturnType<typeof resolveConfig>;
  textColor?: string;
}) {
  // Serial = the item's position among NAMED items, so it matches the "#" column
  // in the line-item table. Customers can map each attachment back to its row.
  const withImages = (items ?? [])
    .filter(i => i.name)
    .map((it, idx) => ({ it, serial: idx + 1 }))
    .filter(x => x.it.images && x.it.images.length > 0);
  if (withImages.length === 0) return null;
  const accent = cfg.accentColor ?? "#6366f1";
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: accent, marginBottom: 8, paddingBottom: 5, borderBottom: `1px solid ${accent}30` }}>Attachments</div>
      {withImages.map(({ it, serial }) => (
        <div key={serial} data-break-block="" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: textColor, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 16, height: 16, padding: "0 4px", borderRadius: 3, background: `${accent}1f`, color: accent, fontSize: 8.5, fontWeight: 700, flexShrink: 0 }}>{serial}</span>
            <span>{it.name}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {it.images!.map((img, i) => (
              <img key={i} src={img} alt={`#${serial} ${it.name}`} style={{ width: 140, height: 140, objectFit: "cover" as const, borderRadius: 5, border: `0.5px solid ${accent}30` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Template: Classic Corporate ─────────────────────────────────────────────
function ClassicDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate, pageIndex = 0, totalPages = 1 }: TemplateProps) {
  const accent = cfg.accentColor ?? "#c8a96e";
  const isReceipt = data.type === "receipt";
  const mainTextColor = cfg.headerTextColor || "#fff";
  const subTextColor = cfg.headerTextColor ? hexToRgba(cfg.headerTextColor, 0.7) : "rgba(255,255,255,0.7)";
  const gap = cfg.contentGap ?? 12;
  const logoSrc = cfg.logoUrl || data.companyLogo;

  const vis = cfg.headerVisibility ?? "all";
  const showHeader = cfg.headerEnabled !== false && (
    vis === "all" ||
    (vis === "first" && pageIndex === 0) ||
    (vis === "last" && pageIndex === totalPages - 1) ||
    (vis === "first-last" && (pageIndex === 0 || pageIndex === totalPages - 1))
  );

  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: cfg.fontFamily, width: 595, minHeight: 800 }}>
      {/* Header */}
      {showHeader && (
        <div data-doc-header="" style={{ background: cfg.headerBg, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {cfg.showLogo && logoSrc && <img src={logoSrc} style={{ height: 36, width: "auto", marginBottom: 4, display: "block", objectFit: "contain" }} alt="Logo" />}
            <div style={{ fontSize: 16, fontWeight: 700, color: mainTextColor, letterSpacing: "0.03em" }}>{companyName}</div>
            {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: subTextColor, marginTop: 3 }}>{data.companyAddress}</div>}
            {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: subTextColor }}>{data.companyPhone}</div>}
            {data.companyEmail && <div style={{ fontSize: 8, color: subTextColor }}>{data.companyEmail}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{typeLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: mainTextColor }}>{docNo}</div>
            <div style={{ fontSize: 8, color: subTextColor, marginTop: 4 }}>Issued: {fmtDate(data.issueDate)}</div>
            {data.dueDate && <div style={{ fontSize: 8, color: subTextColor }}>Due: {fmtDate(data.dueDate)}</div>}
          </div>
        </div>
      )}
      {/* Accent divider */}
      <div style={{ height: 3, background: accent }} />
      {/* Bill to — only first page */}
      {!isReceipt && pageIndex === 0 && (
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
      {/* Terms at start — first page only */}
      {!isReceipt && pageIndex === 0 && cfg.showTerms && (cfg.termsText || data.termsText) && ["start","start-every"].includes(cfg.termsPosition ?? "") && (
        <div style={{ margin: `${gap}px 24px 0` }}>
          <FormattedTerms text={cfg.termsText || data.termsText || ""} color="#777" format={(cfg.termsFormat ?? "paragraph") as any} />
        </div>
      )}
      {/* Items / Receipt body */}
      <div style={{ margin: "0 24px", marginTop: gap }}>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
            <div style={{ marginTop: gap }}><TotalsBlock data={data} cfg={cfg} fmt={fmt} /></div>
            <div style={{ marginTop: gap }}><RemarksBlock remarks={data.remarks} accentColor={accent} /></div>
            <div style={{ marginTop: gap }}><AttachmentsSection items={data.items} cfg={cfg} /></div>
          </>
        }
      </div>
      <DocFooter cfg={cfg} data={data} borderStyle={`1px solid ${accent}40`} defaultTextColor="#888" margin={`${gap}px 24px 0`} pageIndex={pageIndex} totalPages={totalPages} />
    </div>
  );
}

// ─── Template: Modern Gradient ───────────────────────────────────────────────
function ModernGradientDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate, pageIndex = 0, totalPages = 1 }: TemplateProps) {
  const accent = cfg.accentColor ?? "#6366f1";
  const isReceipt = data.type === "receipt";
  const mainTextColor = cfg.headerTextColor || "#fff";
  const subTextColor = cfg.headerTextColor ? hexToRgba(cfg.headerTextColor, 0.75) : "rgba(255,255,255,0.75)";
  const gap = cfg.contentGap ?? 12;
  const logoSrc = cfg.logoUrl || data.companyLogo;

  const vis = cfg.headerVisibility ?? "all";
  const showHeader = cfg.headerEnabled !== false && (
    vis === "all" ||
    (vis === "first" && pageIndex === 0) ||
    (vis === "last" && pageIndex === totalPages - 1) ||
    (vis === "first-last" && (pageIndex === 0 || pageIndex === totalPages - 1))
  );

  return (
    <div style={{ background: "#fff", color: "#1f2937", fontFamily: cfg.fontFamily, width: 595, minHeight: 800 }}>
      {/* Gradient header */}
      {showHeader && (
        <div data-doc-header="" style={{ background: cfg.headerBg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "#fff" }}>
          <div>
            {cfg.showLogo && logoSrc && <img src={logoSrc} style={{ height: 36, width: "auto", marginBottom: 4, display: "block", objectFit: "contain" }} alt="Logo" />}
            <div style={{ fontSize: 15, fontWeight: 700, color: mainTextColor }}>{companyName}</div>
            {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: subTextColor, marginTop: 2 }}>{data.companyAddress}</div>}
            {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: subTextColor }}>{data.companyPhone}</div>}
            {data.companyEmail && <div style={{ fontSize: 8, color: subTextColor }}>{data.companyEmail}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: subTextColor, marginBottom: 2 }}>{typeLabel}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: mainTextColor }}>{docNo}</div>
            <div style={{ fontSize: 8, color: subTextColor, marginTop: 4 }}>Issued: {fmtDate(data.issueDate)}</div>
            {data.dueDate && <div style={{ fontSize: 8, color: subTextColor }}>Due: {fmtDate(data.dueDate)}</div>}
          </div>
        </div>
      )}
      {/* Meta — first page only */}
      {!isReceipt && pageIndex === 0 && (
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
      {/* Terms at start — first page only */}
      {!isReceipt && pageIndex === 0 && cfg.showTerms && (cfg.termsText || data.termsText) && ["start","start-every"].includes(cfg.termsPosition ?? "") && (
        <div style={{ padding: `${gap}px 16px 0` }}>
          <FormattedTerms text={cfg.termsText || data.termsText || ""} color="#777" format={(cfg.termsFormat ?? "paragraph") as any} />
        </div>
      )}
      <div style={{ paddingTop: gap }}>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
            <div style={{ marginTop: gap }}><TotalsBlock data={data} cfg={cfg} fmt={fmt} /></div>
            <div style={{ padding: "0 16px", marginTop: gap }}><RemarksBlock remarks={data.remarks} accentColor={accent} /></div>
            <div style={{ padding: "0 16px", marginTop: gap }}><AttachmentsSection items={data.items} cfg={cfg} /></div>
          </>
        }
      </div>
      <DocFooter cfg={cfg} data={data} borderStyle={`1.5px solid ${accent}`} defaultTextColor="#888" margin={`${gap}px 16px 0`} pageIndex={pageIndex} totalPages={totalPages} />
    </div>
  );
}

// ─── Template: Minimal Clean ─────────────────────────────────────────────────
function MinimalDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate, pageIndex = 0, totalPages = 1 }: TemplateProps) {
  const accent = cfg.accentColor ?? "#374151";
  const isReceipt = data.type === "receipt";
  const mainTextColor = cfg.headerTextColor || "#111";
  const gap = cfg.contentGap ?? 12;
  const logoSrc = cfg.logoUrl || data.companyLogo;

  const vis = cfg.headerVisibility ?? "all";
  const showHeader = cfg.headerEnabled !== false && (
    vis === "all" ||
    (vis === "first" && pageIndex === 0) ||
    (vis === "last" && pageIndex === totalPages - 1) ||
    (vis === "first-last" && (pageIndex === 0 || pageIndex === totalPages - 1))
  );

  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: cfg.fontFamily, width: 595, minHeight: 800, padding: "28px 32px" }}>
      {/* Minimal header */}
      {showHeader && (
        <div data-doc-header="" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: gap }}>
          <div>
            {cfg.showLogo && logoSrc && <img src={logoSrc} style={{ height: 32, width: "auto", marginBottom: 4, display: "block", objectFit: "contain" }} alt="Logo" />}
            <div style={{ fontSize: 14, fontWeight: 700, color: mainTextColor, letterSpacing: "-0.01em" }}>{companyName}</div>
            {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "#888", marginTop: 3 }}>{data.companyAddress}</div>}
            {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "#888" }}>{data.companyPhone}</div>}
            {data.companyEmail && <div style={{ fontSize: 8, color: "#888" }}>{data.companyEmail}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: mainTextColor, letterSpacing: "-0.02em" }}>{typeLabel}</div>
            <div style={{ fontSize: 10, color: "#666", fontWeight: 500 }}>#{docNo}</div>
          </div>
        </div>
      )}
      {/* Hairline divider */}
      <div style={{ height: 0.5, background: "#d1d5db", marginBottom: gap }} />
      {/* Meta — first page only */}
      {!isReceipt && pageIndex === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: gap }}>
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
      {/* Terms at start — first page only */}
      {!isReceipt && pageIndex === 0 && cfg.showTerms && (cfg.termsText || data.termsText) && ["start","start-every"].includes(cfg.termsPosition ?? "") && (
        <div style={{ marginBottom: gap }}>
          <FormattedTerms text={cfg.termsText || data.termsText || ""} color="#9ca3af" format={(cfg.termsFormat ?? "paragraph") as any} />
        </div>
      )}
      <div>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
            <div style={{ marginTop: gap }}><TotalsBlock data={data} cfg={cfg} fmt={fmt} /></div>
            <div style={{ marginTop: gap }}><RemarksBlock remarks={data.remarks} accentColor={accent} textColor="#444" /></div>
            <div style={{ marginTop: gap }}><AttachmentsSection items={data.items} cfg={cfg} /></div>
          </>
        }
      </div>
      <DocFooter cfg={cfg} data={data} borderStyle="0.5px solid #d1d5db" defaultTextColor="#9ca3af" pageIndex={pageIndex} totalPages={totalPages} />
    </div>
  );
}

// ─── Template: Executive Dark ────────────────────────────────────────────────
function ExecutiveDarkDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate, pageIndex = 0, totalPages = 1 }: TemplateProps) {
  const accent = cfg.accentColor ?? "#94a3b8";
  const isReceipt = data.type === "receipt";
  const gap = cfg.contentGap ?? 12;

  const vis = cfg.headerVisibility ?? "all";
  const showHeader = cfg.headerEnabled !== false && (
    vis === "all" ||
    (vis === "first" && pageIndex === 0) ||
    (vis === "last" && pageIndex === totalPages - 1) ||
    (vis === "first-last" && (pageIndex === 0 || pageIndex === totalPages - 1))
  );

  function DarkItemsTable() {
    const displayItems = (data.items ?? []).filter(i => i.name);
    const hasImages = displayItems.some(i => i.images?.length);
    const headers = hasImages ? ["#", "", "Description", "Qty", "Rate", "Total"] : ["#", "Description", "Qty", "Rate", "Total"];
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: h === "" ? "7px 6px" : h === "#" ? "7px 4px" : "7px 10px",
                width: h === "" ? 38 : h === "#" ? 20 : undefined,
                fontSize: 7.5, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em", color: accent,
                textAlign: h === "#" ? "center" : (h === "" || h === "Description") ? "left" : "right",
                borderBottom: `1px solid rgba(148,163,184,0.2)`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayItems.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ padding: 12, textAlign: "center", color: "#64748b", fontSize: 8 }}>No items</td></tr>
          ) : displayItems.map((item, idx) => (
            <tr key={idx} data-break-block="" style={{ background: idx % 2 === 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
              <td style={{ padding: "6px 4px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", color: "#475569", textAlign: "center", fontSize: 8 }}>{idx + 1}</td>
              {hasImages && (
                <td style={{ padding: "4px 6px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", verticalAlign: "middle" }}>
                  {item.images?.[0] && <img src={item.images[0]} alt={item.name} style={{ width: 30, height: 30, objectFit: "cover", borderRadius: 3, display: "block" }} />}
                </td>
              )}
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
      {showHeader && (() => {
        const mainTc = cfg.headerTextColor || "#f8fafc";
        const subTc = cfg.headerTextColor ? hexToRgba(cfg.headerTextColor, 0.6) : "#64748b";
        const logoSrc = cfg.logoUrl || data.companyLogo;
        return (
          <div data-doc-header="" style={{ background: cfg.headerBg, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid rgba(148,163,184,0.15)` }}>
            <div>
              {cfg.showLogo && logoSrc && <img src={logoSrc} style={{ height: 36, width: "auto", marginBottom: 4, display: "block", objectFit: "contain" }} alt="Logo" />}
              <div style={{ fontSize: 14, fontWeight: 700, color: mainTc }}>{companyName}</div>
              {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: subTc, marginTop: 3 }}>{data.companyAddress}</div>}
              {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: subTc }}>{data.companyPhone}</div>}
              {data.companyEmail && <div style={{ fontSize: 8, color: subTc }}>{data.companyEmail}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 8, color: accent, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>{typeLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: mainTc }}>{docNo}</div>
              <div style={{ fontSize: 8, color: subTc, marginTop: 3 }}>{fmtDate(data.issueDate)}</div>
              {data.dueDate && <div style={{ fontSize: 8, color: subTc }}>Due {fmtDate(data.dueDate)}</div>}
            </div>
          </div>
        );
      })()}
      {/* Meta — first page only */}
      {!isReceipt && pageIndex === 0 && (
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
      {/* Terms at start — first page only */}
      {!isReceipt && pageIndex === 0 && cfg.showTerms && (cfg.termsText || data.termsText) && ["start","start-every"].includes(cfg.termsPosition ?? "") && (
        <div style={{ margin: `${gap}px 22px 0` }}>
          <FormattedTerms text={cfg.termsText || data.termsText || ""} color="#475569" format={(cfg.termsFormat ?? "paragraph") as any} />
        </div>
      )}
      <div style={{ padding: "0 22px", paddingTop: gap }}>
        {isReceipt
          ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
          : <>
            <DarkItemsTable />
            {/* Dark totals */}
            <div data-break-block="" style={{ marginTop: gap, display: "flex", justifyContent: "flex-end" }}>
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
            <div style={{ marginTop: gap }}><RemarksBlock remarks={data.remarks} accentColor={accent} textColor="#94a3b8" /></div>
            <div style={{ marginTop: gap }}><AttachmentsSection items={data.items} cfg={cfg} textColor="#94a3b8" /></div>
          </>
        }
      </div>
      <DocFooter cfg={cfg} data={data} borderStyle="0.5px solid rgba(255,255,255,0.08)" defaultTextColor="#475569" margin={`${gap}px 22px 0`} pageIndex={pageIndex} totalPages={totalPages} />
    </div>
  );
}

// ─── Template: Bold Accent ───────────────────────────────────────────────────
function BoldAccentDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate, pageIndex = 0, totalPages = 1 }: TemplateProps) {
  const accent = cfg.accentColor ?? "#f97316";
  const isReceipt = data.type === "receipt";
  const mainTextColor = cfg.headerTextColor || "#111";
  const gap = cfg.contentGap ?? 12;
  const logoSrc = cfg.logoUrl || data.companyLogo;

  const vis = cfg.headerVisibility ?? "all";
  const showHeader = cfg.headerEnabled !== false && (
    vis === "all" ||
    (vis === "first" && pageIndex === 0) ||
    (vis === "last" && pageIndex === totalPages - 1) ||
    (vis === "first-last" && (pageIndex === 0 || pageIndex === totalPages - 1))
  );

  return (
    <div style={{ background: "#fff", color: "#111", fontFamily: cfg.fontFamily, width: 595, minHeight: 800, display: "flex" }}>
      {/* Left accent bar */}
      <div style={{ width: 5, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        {/* Header area */}
        {showHeader && (
          <div data-doc-header="" style={{ padding: "20px 22px 12px", borderBottom: `2px solid ${accent}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                {cfg.showLogo && logoSrc && <img src={logoSrc} style={{ height: 32, width: "auto", marginBottom: 4, display: "block", objectFit: "contain" }} alt="Logo" />}
                <div style={{ fontSize: 16, fontWeight: 800, color: mainTextColor, letterSpacing: "-0.01em" }}>{companyName}</div>
                {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: "#888", marginTop: 2 }}>{data.companyAddress}</div>}
                {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: "#888" }}>{data.companyPhone}</div>}
                {data.companyEmail && <div style={{ fontSize: 8, color: "#888" }}>{data.companyEmail}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>{typeLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: mainTextColor, letterSpacing: "-0.02em" }}>{docNo}</div>
                <div style={{ fontSize: 8, color: "#888" }}>{fmtDate(data.issueDate)}</div>
                {data.dueDate && <div style={{ fontSize: 8, color: "#888" }}>Due {fmtDate(data.dueDate)}</div>}
              </div>
            </div>
          </div>
        )}
        {/* Meta — first page only */}
        {!isReceipt && pageIndex === 0 && (
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
        {/* Terms at start — first page only */}
        {!isReceipt && pageIndex === 0 && cfg.showTerms && (cfg.termsText || data.termsText) && ["start","start-every"].includes(cfg.termsPosition ?? "") && (
          <div style={{ padding: `${gap}px 22px 0` }}>
            <FormattedTerms text={cfg.termsText || data.termsText || ""} color="#777" format={(cfg.termsFormat ?? "paragraph") as any} />
          </div>
        )}
        <div style={{ padding: "0 22px", paddingTop: gap }}>
          {isReceipt
            ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
            : <>
              <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
              <div style={{ marginTop: gap }}><TotalsBlock data={data} cfg={cfg} fmt={fmt} /></div>
              <div style={{ marginTop: gap }}><RemarksBlock remarks={data.remarks} accentColor={accent} /></div>
              <div style={{ marginTop: gap }}><AttachmentsSection items={data.items} cfg={cfg} /></div>
            </>
          }
        </div>
        <DocFooter cfg={cfg} data={data} borderStyle={`2px solid ${accent}`} defaultTextColor="#888" margin={`${gap}px 22px 0`} pageIndex={pageIndex} totalPages={totalPages} />
      </div>
    </div>
  );
}

// ─── Template: Retro Serif ───────────────────────────────────────────────────
function RetroSerifDoc({ cfg, data, typeLabel, docNo, companyName, fmt, fmtDate, pageIndex = 0, totalPages = 1 }: TemplateProps) {
  const accent = cfg.accentColor ?? "#8b4513";
  const isReceipt = data.type === "receipt";
  const mainTextColor = cfg.headerTextColor || accent;
  const subTextColor = cfg.headerTextColor ? hexToRgba(cfg.headerTextColor, 0.8) : "#7c5533";
  const gap = cfg.contentGap ?? 12;
  const logoSrc = cfg.logoUrl || data.companyLogo;

  const vis = cfg.headerVisibility ?? "all";
  const showHeader = cfg.headerEnabled !== false && (
    vis === "all" ||
    (vis === "first" && pageIndex === 0) ||
    (vis === "last" && pageIndex === totalPages - 1) ||
    (vis === "first-last" && (pageIndex === 0 || pageIndex === totalPages - 1))
  );

  return (
    <div style={{ background: "#faf7f0", color: "#2d1b00", fontFamily: cfg.fontFamily, width: 595, minHeight: 800, padding: 16 }}>
      {/* Decorative border frame */}
      <div style={{ border: `2px solid ${accent}`, borderRadius: 2, padding: "18px 22px", minHeight: 760 }}>
        <div style={{ border: `0.5px solid ${accent}60`, borderRadius: 1, padding: "14px 18px", minHeight: 724 }}>
          {/* Header */}
          {showHeader && (
            <div data-doc-header="" style={{ textAlign: "center", borderBottom: `1px solid ${accent}40`, paddingBottom: 12, marginBottom: gap }}>
              {cfg.showLogo && logoSrc && <img src={logoSrc} style={{ height: 32, width: "auto", marginBottom: 4, display: "inline-block", objectFit: "contain" }} alt="Logo" />}
              <div style={{ fontSize: 18, fontWeight: 700, color: mainTextColor, letterSpacing: "0.04em" }}>{companyName}</div>
              {cfg.showAddress && data.companyAddress && <div style={{ fontSize: 8, color: subTextColor, marginTop: 2 }}>{data.companyAddress}</div>}
              {cfg.showPhone && data.companyPhone && <div style={{ fontSize: 8, color: subTextColor }}>{data.companyPhone}</div>}
              {data.companyEmail && <div style={{ fontSize: 8, color: subTextColor }}>{data.companyEmail}</div>}
            </div>
          )}
          {/* Document type & number — first page only */}
          {pageIndex === 0 && (
            <div style={{ textAlign: "center", marginBottom: gap }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, borderTop: `0.5px solid ${accent}40`, borderBottom: `0.5px solid ${accent}40`, padding: "4px 0", display: "inline-block", minWidth: 140 }}>{typeLabel}</div>
              <div style={{ fontSize: 10, color: "#7c5533", marginTop: 4, fontStyle: "italic" }}>No. {docNo}</div>
              <div style={{ fontSize: 8, color: "#7c5533" }}>Issued: {fmtDate(data.issueDate)}{data.dueDate ? ` · Due: ${fmtDate(data.dueDate)}` : ""}</div>
            </div>
          )}
          {/* Meta — first page only */}
          {!isReceipt && pageIndex === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: gap, borderBottom: `0.5px solid ${accent}30`, paddingBottom: 12 }}>
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
          {/* Terms at start — first page only */}
          {!isReceipt && pageIndex === 0 && cfg.showTerms && (cfg.termsText || data.termsText) && ["start","start-every"].includes(cfg.termsPosition ?? "") && (
            <div style={{ marginBottom: gap }}>
              <FormattedTerms text={cfg.termsText || data.termsText || ""} color="#7c5533" fontStyle="italic" format={(cfg.termsFormat ?? "paragraph") as any} />
            </div>
          )}
          {isReceipt
            ? <ReceiptBody data={data} cfg={cfg} fmt={fmt} fmtDate={fmtDate} />
            : <>
              <ItemsTable items={data.items} cfg={cfg} fmt={fmt} />
              <div style={{ marginTop: gap }}><TotalsBlock data={data} cfg={cfg} fmt={fmt} /></div>
              <div style={{ marginTop: gap }}><RemarksBlock remarks={data.remarks} accentColor={accent} textColor="#7c5533" /></div>
              <div style={{ marginTop: gap }}><AttachmentsSection items={data.items} cfg={cfg} textColor="#7c5533" /></div>
            </>
          }
          <DocFooter cfg={cfg} data={data} borderStyle={`0.5px solid ${accent}40`} defaultTextColor={accent} fontStyle="italic" pageIndex={pageIndex} totalPages={totalPages} />
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
  pageIndex?: number;
  totalPages?: number;
}
