import { Button } from "@/components/ui/button";
import { T3 } from "@/lib/ds";

interface Pagination {
  pages: number;
  limit: number;
  total: number;
}

interface PaginationBarProps {
  page: number;
  pagination: Pagination | undefined;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Reusable prev/next pagination bar.
 *
 * Replaces the identical pagination block that was copy-pasted into invoices,
 * customers, quotations, expenses, and other list pages. Returns `null` when
 * there is only one page so it takes up zero space.
 *
 * Usage:
 *   <PaginationBar
 *     page={page}
 *     pagination={data?.pagination}
 *     onPrev={() => setPage(p => p - 1)}
 *     onNext={() => setPage(p => p + 1)}
 *   />
 */
export function PaginationBar({
  page,
  pagination,
  onPrev,
  onNext,
}: PaginationBarProps) {
  if (!pagination || pagination.pages <= 1) return null;

  const from = (page - 1) * pagination.limit + 1;
  const to = Math.min(page * pagination.limit, pagination.total);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 12, color: T3 }}>
        {from}–{to} of {pagination.total}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={onPrev}
        >
          ← Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pagination.pages}
          onClick={onNext}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
