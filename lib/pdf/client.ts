import { downloadFile } from "@/lib/pdf-export";

type PdfType = "invoice" | "quotation";

/**
 * Fetch a server-generated (headless-Chrome) PDF as a Blob. The API returns raw
 * bytes for small PDFs, or `{ url }` (Cloudinary) for ones over Vercel's 4.5 MB
 * response cap — both are normalized to a Blob here.
 */
async function fetchPdf(type: PdfType, id: string): Promise<Blob> {
  const res = await fetch(`/api/pdf/${type}/${id}`, { method: "GET" });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) throw new Error(data?.error ?? `PDF generation failed (${res.status})`);
    const fileRes = await fetch(data.url);
    if (!fileRes.ok) throw new Error("Failed to fetch generated PDF");
    return fileRes.blob();
  }
  if (!res.ok) throw new Error(`PDF generation failed (${res.status})`);
  return res.blob();
}

export async function fetchServerPdfBlob(type: PdfType, id: string): Promise<Blob> {
  return fetchPdf(type, id);
}

export async function downloadServerPdf(type: PdfType, id: string, fileName: string): Promise<void> {
  const blob = await fetchPdf(type, id);
  const name = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  downloadFile(new File([blob], name, { type: "application/pdf" }));
}
