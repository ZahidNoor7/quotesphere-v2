import { cn } from "@/lib/utils";
import { TABLE_WRAP, TABLE_STYLE, TH_STYLE, TD_STYLE } from "@/lib/ds";

/**
 * data-table.tsx — lightweight composable table primitives.
 *
 * Why composable instead of a single <DataTable columns={...} data={...}> API?
 * Each list page has unique action cells, custom badge renderers, and link
 * wrappers that would make a fully generic DataTable unwieldy. Composable
 * primitives give each page full control while still enforcing consistent
 * spacing, colors, and hover behaviour from a single source.
 *
 * All style values come from lib/ds.ts so they respond to theme changes.
 */

// ─── Outer wrapper ────────────────────────────────────────────────────────────

/**
 * Glass-card wrapper for table containers.
 * Replaces the repeated `<div style={TABLE_WRAP}>` pattern.
 * Accepts `style` and `className` for per-page overrides (e.g. flex: 1, overflowY: "auto").
 */
export function TableWrapper({
  children,
  className,
  style,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{ ...TABLE_WRAP, overflowX: "auto", ...style }}
      className={className}
    >
      {children}
    </div>
  );
}

// ─── <table> ──────────────────────────────────────────────────────────────────

/**
 * Standard table element.
 * `tableLayout: "fixed"` is applied by default for predictable column widths.
 */
export function DataTable({
  children,
  className,
  style,
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      style={{ ...TABLE_STYLE, tableLayout: "fixed", ...style }}
      className={className}
    >
      {children}
    </table>
  );
}

// ─── <th> ─────────────────────────────────────────────────────────────────────

/**
 * Table header cell with the standard uppercase / small-caps design.
 * `style` prop is merged so per-column widths still work: <Th style={{ width: 95 }}>
 */
export function Th({
  children,
  style,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th style={{ ...TH_STYLE, ...style }} className={className} {...props}>
      {children}
    </th>
  );
}

// ─── <td> ─────────────────────────────────────────────────────────────────────

/**
 * Standard data cell with overflow ellipsis baked in.
 * Override `style` for per-column colour / weight adjustments.
 */
export function Td({
  children,
  style,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td style={{ ...TD_STYLE, ...style }} className={cn("max-w-0", className)} {...props}>
      {children}
    </td>
  );
}

// ─── <tr> ─────────────────────────────────────────────────────────────────────

/**
 * Table row with CSS-driven hover highlight.
 * Replaces the manual `onMouseEnter/Leave` querySelectorAll pattern that
 * mutated `td.style.background` imperatively. The `.table-row-hover` class
 * in globals.css handles the same effect with zero JS.
 */
export function Tr({
  children,
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      style={style}
      className={cn("table-row-hover cursor-pointer", className)}
      {...props}
    >
      {children}
    </tr>
  );
}
