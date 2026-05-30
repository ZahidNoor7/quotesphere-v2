import { Skeleton } from "@/components/ui/skeleton";
import { TOPBAR_STYLE } from "@/lib/ds";

/**
 * Dashboard loading skeleton.
 * Extracted from `app/dashboard/page.tsx` so it can be shared between:
 *  - The SWR `isLoading` state in the page component
 *  - The Next.js route-level `app/dashboard/loading.tsx`
 *
 * Mirrors the exact grid structure of the real dashboard to avoid layout shift.
 */
export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <Skeleton className="h-5 w-24" />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
      </div>

      <div style={{ padding: "18px 20px" }}>
        {/* Tab strip */}
        <Skeleton className="h-8 w-44 rounded-full mb-[18px]" />

        {/* KPI grid — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-[18px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card" style={{ padding: "14px 16px" }}>
              <Skeleton className="h-7 w-7 rounded-lg mb-2.5" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2 mb-1.5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>

        {/* 2-column card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Chart card */}
          <div className="glass-card" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-[140px] w-full" />
          </div>

          {/* Progress list card */}
          <div className="glass-card" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-[3px] w-full rounded-full" />
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="glass-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px 10px",
              }}
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div style={{ padding: "0 16px 14px" }}>
              <div
                className="grid grid-cols-4 gap-2 mb-2 pb-2"
                style={{ borderBottom: "0.5px solid var(--glass-border)" }}
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-3" />
                ))}
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-4 gap-2 items-center"
                  style={{
                    borderTop: "0.5px solid var(--glass-border)",
                    paddingTop: 8,
                    marginTop: 2,
                  }}
                >
                  <Skeleton className="h-3.5" />
                  <Skeleton className="h-3.5" />
                  <Skeleton className="h-3.5" />
                  <Skeleton className="h-5 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Pie chart card */}
          <div className="glass-card" style={{ padding: 16 }}>
            <Skeleton className="h-4 w-36 mb-4" />
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Skeleton
                className="h-[160px] w-[160px]"
                style={{ borderRadius: "50%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
