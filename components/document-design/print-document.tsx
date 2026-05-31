import { resolveConfig } from "@/lib/document-designs";
import type { DocumentDesign } from "@/types";
import { DocumentTemplate, type DocumentData } from "./document-renderer";
import { getContentZoom } from "@/lib/page-dims";

/**
 * Print-mode wrapper rendered by the `/print/[type]/[id]` route. Headless Chrome
 * loads it and calls `page.pdf()`. The `@page` size + margins come from the
 * design config (page size/orientation/margins), and the 595px design is
 * `zoom`-scaled to fill the page's printable width — so the chosen page size
 * actually applies to the exported PDF. `zoom` (not `transform: scale`) reflows
 * layout so Chrome paginates against the printed size.
 */
export function PrintDocument({ design, data }: { design: DocumentDesign; data: DocumentData }) {
  const cfg = resolveConfig(design);
  const size = cfg.pageSize ?? "A4"; // A4 | A5 | Letter | Legal — all valid CSS @page sizes
  const orientation = cfg.pageOrientation ?? "portrait";
  const mt = cfg.marginTop || 0;
  const mr = cfg.marginRight || 0;
  const mb = cfg.marginBottom || 0;
  const ml = cfg.marginLeft || 0;
  const zoom = getContentZoom(cfg); // scale the 595px design to the page's printable width

  return (
    <>
      <style>{`@page { size: ${size} ${orientation}; margin: ${mt}px ${mr}px ${mb}px ${ml}px; }`}</style>
      <div style={{ zoom }}>
        <DocumentTemplate design={design} data={data} />
      </div>
    </>
  );
}
