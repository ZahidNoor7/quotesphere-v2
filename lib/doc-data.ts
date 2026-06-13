import type { DocumentData } from "@/components/document-design/document-renderer";
import type { RichTextContent } from "@/types";

export type { DocumentData };

/**
 * Single source of truth for mapping a stored Invoice/Quotation (+ Settings)
 * into the `DocumentData` the renderer consumes. Pure & isomorphic — used by
 * BOTH the on-screen preview call sites AND the server print route, so the
 * preview and the exported PDF render from identical data (zero drift).
 */

/** Only allow inline base64 image data URIs into the document (defensive — rejects URLs/`javascript:` etc.). */
export function safeImg(src: string | undefined | null): src is string {
  return !!src && /^data:image\//i.test(src);
}

type Dateish = string | Date | undefined | null;
function toISO(d: Dateish): string | undefined {
  if (!d) return undefined;
  try {
    return typeof d === "string" ? d : new Date(d).toISOString();
  } catch {
    return undefined;
  }
}

interface DocItemInput {
  name: string;
  description?: RichTextContent;
  quantity: number;
  price: number;
  images?: string[];
}

/** Structural shape shared by the client `Invoice`/`Quotation` types and the server lean Mongoose docs. */
export interface DocInput {
  invoice_no?: string;
  quotation_no?: string;
  issue_date?: Dateish;
  due_date?: Dateish;
  valid_until?: Dateish;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  items?: DocItemInput[];
  sub_total?: number;
  tax?: number;
  tax_type?: "percentage" | "value";
  discount?: number;
  delivery_charges?: number;
  total_amount?: number;
  advance?: number;
  outstanding?: number;
  currency?: string;
  remarks?: RichTextContent;
}

export interface SettingsInput {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  terms_and_conditions?: string;
}

export function buildDocumentData(
  type: "invoice" | "quotation",
  doc: DocInput,
  settings?: SettingsInput | null,
): DocumentData {
  const subTotal = doc.sub_total ?? 0;
  const taxAmt = doc.tax_type === "percentage" ? (subTotal * (doc.tax ?? 0)) / 100 : (doc.tax ?? 0);
  const taxLabel = doc.tax_type === "percentage" ? `Tax (${doc.tax ?? 0}%)` : "Tax";

  return {
    type,
    docNo: type === "invoice" ? doc.invoice_no : doc.quotation_no,
    issueDate: toISO(doc.issue_date),
    dueDate: toISO(type === "invoice" ? doc.due_date : doc.valid_until),
    customer: {
      name: doc.customer_name,
      phone: doc.customer_phone,
      address: doc.customer_address,
    },
    items: (doc.items ?? []).map((i) => ({
      name: i.name,
      description: i.description,
      quantity: i.quantity,
      price: i.price,
      images: (i.images ?? []).filter(safeImg),
    })),
    subTotal,
    taxAmt,
    taxLabel,
    discount: doc.discount,
    delivery: doc.delivery_charges,
    total: doc.total_amount,
    advance: type === "invoice" ? doc.advance : undefined,
    outstanding: type === "invoice" ? doc.outstanding : undefined,
    currency: doc.currency,
    remarks: doc.remarks,
    companyName: settings?.company_name ?? "Your Company",
    companyEmail: settings?.company_email,
    companyPhone: settings?.company_phone,
    companyAddress: settings?.company_address,
    termsText: settings?.terms_and_conditions,
  };
}
