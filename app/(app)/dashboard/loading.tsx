// Route-level loading file — shown by Next.js during page navigation.
// Imports the shared DashboardSkeleton so the skeleton is defined in one place
// and reused for both navigation loading and the SWR isLoading state.
import { DashboardSkeleton } from "@/components/loaders";

export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
