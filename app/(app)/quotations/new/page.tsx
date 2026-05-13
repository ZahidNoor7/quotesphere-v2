"use client";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { DocumentBuilder } from "@/components/forms/document-builder";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

function stripDuplicateFields(doc: Record<string, unknown>) {
  const { quotation_no, invoice_no, converted_to, converted_from,
    _id, createdAt, updatedAt, ...rest } = doc;
  void quotation_no; void invoice_no; void converted_to; void converted_from;
  void _id; void createdAt; void updatedAt;
  return { ...rest, issue_date: new Date().toISOString().slice(0, 10), valid_until: undefined };
}

function templateToInitialData(tpl: Record<string, unknown>) {
  return {
    items: tpl.items,
    tax: tpl.tax,
    tax_type: tpl.tax_type,
    discount: tpl.discount,
    delivery_charges: tpl.delivery_charges,
    currency: tpl.currency,
    remarks: tpl.remarks,
    designId: tpl.designId,
  };
}

export default function NewQuotationPage() {
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");
  const templateId = searchParams.get("template");

  const { data: sourceDoc, isLoading: loadingFrom } = useSWR(
    fromId ? `/api/quotations/${fromId}` : null, fetcher
  );
  const { data: templateDoc, isLoading: loadingTemplate } = useSWR(
    templateId ? `/api/templates/${templateId}` : null, fetcher
  );

  if ((fromId && loadingFrom) || (templateId && loadingTemplate)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const initialData = sourceDoc
    ? stripDuplicateFields(sourceDoc)
    : templateDoc
    ? templateToInitialData(templateDoc)
    : undefined;

  return <DocumentBuilder type="quotation" initialData={initialData} />;
}
