// Route-level loading for invoices list — shown during Next.js page navigation.
import { PageSkeleton } from "@/components/loaders";

export default function InvoicesLoading() {
  // cols=8 matches: checkbox + invoice# + client + amount + status + payment + date + actions
  return <PageSkeleton filterCount={3} tableRows={8} tableCols={6} />;
}
