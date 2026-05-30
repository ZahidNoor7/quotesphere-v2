import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  /** Number of shimmer rows to render (default 7) */
  rows?: number;
  /** Number of column slots per row (default 5) */
  cols?: number;
}

/**
 * Generic table loading skeleton.
 * Mirrors the table's thead + tbody structure so the layout shift is minimal
 * when real data arrives. Drop this inside the same TableWrapper the real table uses.
 */
export function TableSkeleton({ rows = 7, cols = 5 }: TableSkeletonProps) {
  return (
    <div>
      {/* Simulated header row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 12px",
          background: "var(--glass)",
          borderBottom: "0.5px solid var(--glass-border)",
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3"
            style={{ flex: i === 1 ? 2 : 1 }}
          />
        ))}
      </div>

      {/* Simulated data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            gap: 8,
            padding: "11px 12px",
            borderTop: "0.5px solid var(--glass-border)",
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3.5"
              style={{ flex: c === 1 ? 2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
