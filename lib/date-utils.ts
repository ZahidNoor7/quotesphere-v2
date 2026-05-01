import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export type Period = "month" | "3months" | "6months" | "year" | "custom";

/**
 * Appends `from` / `to` query params to `params` based on the selected period.
 * Shared by the invoices, quotations, and expenses list pages.
 */
export function applyPeriodParams(
  params: URLSearchParams,
  period: Period,
  dateRange?: DateRange
): void {
  const now = new Date();
  switch (period) {
    case "month":
      params.set("from", format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
      break;
    case "3months":
      params.set("from", format(new Date(now.getFullYear(), now.getMonth() - 2, 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
      break;
    case "6months":
      params.set("from", format(new Date(now.getFullYear(), now.getMonth() - 5, 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
      break;
    case "year":
      params.set("from", format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
      params.set("to", format(now, "yyyy-MM-dd"));
      break;
    case "custom":
      if (dateRange?.from) {
        params.set("from", format(dateRange.from, "yyyy-MM-dd"));
        if (dateRange.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"));
      }
      break;
  }
}
