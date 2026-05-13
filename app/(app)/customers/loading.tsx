// Route-level loading for customers list — shown during Next.js page navigation.
import { PageSkeleton } from "@/components/loaders";

export default function CustomersLoading() {
  // hasKpis=true mirrors the 2 mini-stat cards at the top of the customers page
  return <PageSkeleton hasKpis kpiCount={2} filterCount={3} tableRows={8} tableCols={5} />;
}
