/**
 * Opens a print-optimized window for native browser PDF export.
 * Produces sharp vector text — no pixelation on zoom.
 *
 * Resolves CSS custom properties by collecting all --var names from every
 * style rule in the document and injecting their computed values into :root
 * so the print window renders identically to the app.
 */
export async function printAsPdf(elementId: string, title: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) return;

  // 1. <link rel="stylesheet"> tags (Tailwind, fonts, etc.)
  const linkTags = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  ).map(l => `<link rel="stylesheet" href="${l.href}">`).join("\n");

  // 2. Inline <style> tags (Next.js injects Tailwind here in dev/prod)
  const styleTags = Array.from(document.querySelectorAll("style"))
    .map(s => `<style>${s.textContent}</style>`).join("\n");

  // 3. Collect every CSS custom property name used in any style rule
  const customPropNames = new Set<string>();
  const collectFromRules = (rules: CSSRuleList) => {
    Array.from(rules).forEach(rule => {
      if (rule instanceof CSSStyleRule) {
        Array.from(rule.style).forEach(p => {
          if (p.trim().startsWith("--")) customPropNames.add(p.trim());
        });
      } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
        collectFromRules(rule.cssRules);
      }
    });
  };
  Array.from(document.styleSheets).forEach(sheet => {
    try { collectFromRules(sheet.cssRules); } catch {}
  });

  // 4. Resolve each custom property's current computed value
  const rootComputed = getComputedStyle(document.documentElement);
  const cssVarEntries = Array.from(customPropNames)
    .map(prop => {
      const val = rootComputed.getPropertyValue(prop).trim();
      return val ? `${prop}:${val}` : null;
    })
    .filter(Boolean)
    .join(";");

  const resolvedVarBlock = cssVarEntries
    ? `<style>:root{${cssVarEntries}}</style>`
    : "";

  // 5. Copy html-level class/data attributes so dark-mode or theme classes apply
  const htmlAttrs = Array.from(document.documentElement.attributes)
    .map(a => `${a.name}="${a.value}"`).join(" ");

  const win = window.open("", "_blank", "width=820,height=1100");
  if (!win) return;

  win.document.write(
    `<!DOCTYPE html><html ${htmlAttrs}><head><title>${title}</title>${linkTags}${styleTags}${resolvedVarBlock}<style>@page{margin:0;size:A4 portrait}html,body{margin:0;padding:0;background:white}</style></head><body>${el.outerHTML}</body></html>`
  );
  win.document.close();

  // Wait for fonts in the print window to finish loading before triggering print.
  // document.fonts.ready resolves as soon as all @font-face rules are done —
  // far more reliable than a fixed timeout which under-waits on slow connections
  // and over-waits on fast ones.
  await win.document.fonts.ready;
  win.focus();
  win.print();
  win.close();
}

/**
 * Generates a PDF File from a rendered DOM element using html2canvas + jsPDF.
 * Used for file sharing (WhatsApp, email attachments) where a File object is needed.
 * Uses dynamic imports to keep the main bundle lightweight.
 */
export async function generatePdfFromElement(
  elementId: string,
  fileName: string
): Promise<File | null> {
  const el = document.getElementById(elementId);
  if (!el) return null;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 4,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = pageW / imgW;
  const scaledH = imgH * ratio;

  // Slice canvas into A4-sized pages
  let yOffset = 0;
  let pageNo = 0;
  while (yOffset < scaledH) {
    if (pageNo > 0) pdf.addPage();

    const srcSliceH = Math.min(pageH / ratio, imgH - yOffset / ratio);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = imgW;
    sliceCanvas.height = Math.ceil(srcSliceH);
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.drawImage(canvas, 0, yOffset / ratio, imgW, srcSliceH, 0, 0, imgW, srcSliceH);

    // PNG is lossless — no JPEG compression artifacts
    const sliceData = sliceCanvas.toDataURL("image/png");
    pdf.addImage(sliceData, "PNG", 0, 0, pageW, srcSliceH * ratio);

    yOffset += pageH;
    pageNo++;
  }

  const blob = pdf.output("blob");
  return new File([blob], fileName, { type: "application/pdf" });
}

/** Downloads a File/Blob to the user's device. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
