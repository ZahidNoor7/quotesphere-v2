"use client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TOOLBAR_CONTROL } from "@/lib/ds";

interface SearchFilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export function SearchFilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search...",
  children,
}: SearchFilterBarProps) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={searchPlaceholder}
        style={{ flex: 1, minWidth: 140, ...TOOLBAR_CONTROL }}
      />
      {children}
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A filter select for use inside <SearchFilterBar>.
 * Wraps shadcn Select with glass styling applied globally via select.tsx.
 *
 * Usage:
 *   <SearchFilterBar search={search} onSearch={v => setSearch(v)}>
 *     <FilterSelect value={status} onValueChange={setStatus} placeholder="All status">
 *       <SelectItem value="pending">Pending</SelectItem>
 *       ...
 *     </FilterSelect>
 *   </SearchFilterBar>
 */
export function FilterSelect({ value, onValueChange, placeholder, className, children }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger style={{ ...TOOLBAR_CONTROL }} className={`w-auto min-w-27.5 ${className ?? ""}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {children}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export { SelectItem };
