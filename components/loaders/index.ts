/**
 * /components/loaders – centralized loading & skeleton components.
 *
 * Architecture rule:
 *   - ALL spinners, skeletons, and loading states belong here.
 *   - Pages and feature components MUST import from "@/components/loaders".
 *   - Do NOT define loading UI inline inside pages or feature components.
 */

export { Spinner, SpinnerCenter } from "./spinner";
export { TableSkeleton } from "./table-skeleton";
export { PageSkeleton } from "./page-skeleton";
export { DashboardSkeleton } from "./dashboard-skeleton";
