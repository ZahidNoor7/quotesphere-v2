import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "./table-skeleton";
import { TOPBAR_STYLE, TABLE_WRAP } from "@/lib/ds";

interface PageSkeletonProps {
  /** Show small KPI stat cards above the filters (e.g. customers page) */
  hasKpis?: boolean;
  /** How many KPI cards to render (default 2) */
  kpiCount?: number;
  /** How many filter controls to show (default 3) */
  filterCount?: number;
  /** Table skeleton rows (default 7) */
  tableRows?: number;
  /** Table skeleton columns (default 5) */
  tableCols?: number;
}

/**
 * Full-page skeleton for list pages (invoices, customers, expenses, etc.).
 * Renders the topbar + optional KPIs + filter row + table skeleton so the
 * layout matches the real page, eliminating jarring shifts on first load.
 *
 * Used by Next.js route-level `loading.tsx` files for each list route.
 */
export function PageSkeleton({
  hasKpis = false,
  kpiCount = 2,
  filterCount = 3,
  tableRows = 7,
  tableCols = 5,
}: PageSkeletonProps) {
  return (
    <div
      className="animate-fade-in"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Topbar skeleton — same dimensions as the real PageHeader */}
      <div style={TOPBAR_STYLE}>
        <Skeleton className="h-5 w-24" />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
      </div>

      <div
        style={{
          padding: "18px 20px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
        }}
      >
        {/* Optional KPI cards (customers page) */}
        {hasKpis && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${kpiCount}, 1fr)`,
              gap: 10,
              maxWidth: 360,
            }}
          >
            {Array.from({ length: kpiCount }).map((_, i) => (
              <div key={i} className="kpi-card" style={{ padding: "12px 14px" }}>
                <Skeleton className="h-5 w-12 mb-1.5" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        )}

        {/* Filter bar skeleton */}
        <div style={{ display: "flex", gap: 7 }}>
          <Skeleton
            className="h-8 rounded-full"
            style={{ flex: 1, minWidth: 140, maxWidth: 280 }}
          />
          {Array.from({ length: filterCount - 1 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>

        {/* Table skeleton */}
        <div style={{ ...TABLE_WRAP, flex: 1 }}>
          <TableSkeleton rows={tableRows} cols={tableCols} />
        </div>
      </div>
    </div>
  );
}
