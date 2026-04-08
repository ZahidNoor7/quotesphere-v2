/**
 * Generates a PDF File from a rendered DOM element using html2canvas + jsPDF.
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
    scale: 2,
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

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(sliceData, "JPEG", 0, 0, pageW, srcSliceH * ratio);

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
