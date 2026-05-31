import type { resolveConfig } from "@/lib/document-designs";

type Cfg = ReturnType<typeof resolveConfig>;

/**
 * Page-size geometry shared by the PDF generator (PrintDocument) and the live
 * preview (DocumentRenderer), so picking A4/A5/Letter/Legal + portrait/landscape
 * applies identically in both. The document is authored at 595px wide (= A4
 * width); other sizes scale that design to fit each page's content width.
 */

/** Physical page sizes in CSS px @96dpi (portrait). */
const PAGE_PX: Record<string, [number, number]> = {
  A4: [794, 1123], // 210 × 297 mm
  A5: [559, 794], // 148 × 210 mm
  Letter: [816, 1056], // 8.5 × 11 in
  Legal: [816, 1344], // 8.5 × 14 in
};

export function getPagePx(cfg: Cfg): { w: number; h: number } {
  const [w, h] = PAGE_PX[cfg.pageSize ?? "A4"] ?? PAGE_PX.A4;
  return cfg.pageOrientation === "landscape" ? { w: h, h: w } : { w, h };
}

/** Zoom that scales the 595px design to the page's printable width (for the PDF). */
export function getContentZoom(cfg: Cfg): number {
  const { w } = getPagePx(cfg);
  const mL = cfg.marginLeft || 0;
  const mR = cfg.marginRight || 0;
  return Math.max(0.1, (w - mL - mR) / 595);
}

/**
 * Page height expressed in the preview's 595px-wide coordinate space — i.e. how
 * tall one page is when the design width (595) maps to the page width. Drives the
 * preview's page-break slicing so pagination matches the chosen page size.
 */
export function getPreviewPageHeight(cfg: Cfg): number {
  const { w, h } = getPagePx(cfg);
  return Math.round((595 * h) / w);
}
