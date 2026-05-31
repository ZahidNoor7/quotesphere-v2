import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Settings from "@/models/Settings";
import { getDesignById, getDefaultDesign } from "@/lib/document-designs";
import { buildDocumentData, type DocInput, type SettingsInput } from "@/lib/doc-data";
import { verifyPrintToken } from "@/lib/print-token";
import { PrintDocument } from "@/components/document-design/print-document";
import type { DocumentDesign } from "@/types";

// Token-gated, no caching — rendered only by the headless-Chrome PDF route
// (or, as a fallback, a freshly-minted client print window).
export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { type, id } = await params;
  const tokenRaw = (await searchParams).token;
  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;

  if ((type !== "invoice" && type !== "quotation") || !isValidObjectId(id)) notFound();
  const payload = verifyPrintToken(token, type, id);
  if (!payload) notFound();

  await connectDB();
  const raw =
    type === "invoice"
      ? await Invoice.findById(id).lean()
      : await Quotation.findById(id).lean();
  if (!raw) notFound();
  // Boundary cast: Mongoose lean() → our structural DTO.
  const doc = raw as unknown as DocInput & { designId?: string };

  const settingsDoc = await Settings.findOne({ user_id: payload.uid }).lean();
  const settings = settingsDoc as unknown as
    | (SettingsInput & {
        documentDesigns?: DocumentDesign[];
        lastUsed?: { invoiceDesignId?: string; quotationDesignId?: string };
      })
    | null;

  const userDesigns: DocumentDesign[] = settings?.documentDesigns ?? [];
  const designId =
    doc.designId ??
    (type === "invoice" ? settings?.lastUsed?.invoiceDesignId : settings?.lastUsed?.quotationDesignId);
  const design = designId ? getDesignById(designId, userDesigns) : getDefaultDesign(type, userDesigns);

  const data = buildDocumentData(type, doc, settings);

  return <PrintDocument design={design} data={data} />;
}
