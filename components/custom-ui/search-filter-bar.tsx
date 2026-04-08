import { GLASS_INPUT, GLASS_SELECT } from "@/lib/ds";

interface SearchFilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  /** Additional filter controls (FilterSelect elements) */
  children?: React.ReactNode;
}

/**
 * Standardized search + filter row.
 *
 * Replaces the duplicated `<div style={{ display:"flex", gap: 7, flexWrap:"wrap" }}>`
 * + `<input style={GLASS_INPUT}>` pattern found on every list page.
 *
 * The search input gets `flex:1` so it fills available space; extra filter
 * controls are passed as children (typically <FilterSelect> elements).
 *
 * Usage:
 *   <SearchFilterBar search={search} onSearch={v => { setSearch(v); setPage(1); }}
 *     searchPlaceholder="Search by # or client...">
 *     <FilterSelect value={status} onChange={e => setStatus(e.target.value)}>
 *       <option value="">All status</option>
 *       ...
 *     </FilterSelect>
 *   </SearchFilterBar>
 */
export function SearchFilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search...",
  children,
}: SearchFilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 7,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        style={{ ...GLASS_INPUT, flex: 1, minWidth: 140 }}
      />
      {children}
    </div>
  );
}

/**
 * A single filter select for use inside <SearchFilterBar>.
 * Inherits the standard glass pill select style from lib/ds.ts.
 */
export function FilterSelect({
  children,
  style,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select style={{ ...GLASS_SELECT, ...style }} {...props}>
      {children}
    </select>
  );
}
