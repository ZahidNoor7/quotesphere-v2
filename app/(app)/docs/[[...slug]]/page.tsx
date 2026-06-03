import { notFound } from "next/navigation";
import { DOC_SECTIONS, DEFAULT_SLUG, findDoc, getDocContent, getDocsIndex } from "@/lib/docs";
import { DocsView } from "@/components/docs/DocsView";

export const dynamic = "force-dynamic";

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const current = slug?.[0] ?? DEFAULT_SLUG;
  if (!findDoc(current)) notFound();
  const content = getDocContent(current) ?? "# Not found\n\nThis guide is unavailable.";
  return <DocsView sections={DOC_SECTIONS} current={current} content={content} index={getDocsIndex()} />;
}
