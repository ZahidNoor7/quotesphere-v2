"use client";
import { use } from "react";
import useSWR from "swr";
import { DocumentBuilder } from "@/components/forms/document-builder";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useSWR(`/api/invoices/${id}`, fetcher);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <DocumentBuilder type="invoice" initialData={data} />;
}
