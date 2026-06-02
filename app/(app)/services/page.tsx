"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, FilterX, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { SearchFilterBar, FilterSelect, SelectItem } from "@/components/custom-ui/search-filter-bar";
import { IconAction } from "@/components/custom-ui/icon-action";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ServiceSheet } from "@/components/services/service-sheet";
import { ImportSheet, IMPORT_CONFIGS } from "@/components/import/ImportSheet";

import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS_BORDER, TOPBAR_STYLE } from "@/lib/ds";
import type { Service } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data as Service[]);

const CATEGORIES = ["General", "Consultation", "Installation", "Repair", "Cleaning", "Inspection", "Design", "Delivery", "Other"];
const UNITS = ["job", "hr", "day", "item", "sq ft", "m²", "kg", "piece"];

type StatusFilter = "active" | "inactive" | "all";
type SortKey = "name-asc" | "price-desc" | "price-asc";

const SORTERS: Record<SortKey, (a: Service, b: Service) => number> = {
  "name-asc": (a, b) => a.name.localeCompare(b.name),
  "price-desc": (a, b) => b.default_price - a.default_price,
  "price-asc": (a, b) => a.default_price - b.default_price,
};

export default function ServicesPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("all");
  const [unit, setUnit] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<SortKey>("name-asc");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Debounce the (server-side) text search so we don't hit $text on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = `/api/services?status=${status}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`;
  const { data: services = [], mutate, isLoading, error } = useSWR<Service[]>(key, fetcher);

  const filtersActive = Boolean(debounced) || category !== "all" || unit !== "all" || status !== "active" || sort !== "name-asc";

  function clearFilters() {
    setSearch(""); setDebounced(""); setCategory("all"); setUnit("all"); setStatus("active"); setSort("name-asc");
  }

  // Category & unit are filtered client-side; results are grouped by category with the chosen sort applied within each group.
  const grouped = useMemo(() => {
    const filtered = services.filter(s =>
      (category === "all" || s.category === category) &&
      (unit === "all" || s.unit === unit)
    );
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    for (const arr of map.values()) arr.sort(SORTERS[sort]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [services, category, unit, sort]);

  const visibleCount = grouped.reduce((n, [, arr]) => n + arr.length, 0);

  async function del(id: string) {
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not delete service");
      toast.success("Service deleted.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete service");
    }
  }

  function openNew() { setEditSvc(null); setSheetOpen(true); }
  function openEdit(s: Service) { setEditSvc(s); setSheetOpen(true); }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ImportSheet open={importOpen} onOpenChange={setImportOpen} config={IMPORT_CONFIGS.services} onDone={() => mutate()} />
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Services catalog</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="size-4" />Import</Button>
          <Button onClick={openNew} size="sm"><Plus className="size-4" />Add service</Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Filters */}
        <SearchFilterBar search={search} onSearch={setSearch} searchPlaceholder="Search services...">
          <FilterSelect value={category} onValueChange={setCategory} placeholder="Category">
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </FilterSelect>
          <FilterSelect value={unit} onValueChange={setUnit} placeholder="Unit">
            <SelectItem value="all">All units</SelectItem>
            {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </FilterSelect>
          <FilterSelect value={status} onValueChange={v => setStatus(v as StatusFilter)} placeholder="Status">
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </FilterSelect>
          <FilterSelect value={sort} onValueChange={v => setSort(v as SortKey)} placeholder="Sort">
            <SelectItem value="name-asc">Name (A–Z)</SelectItem>
            <SelectItem value="price-desc">Price (high → low)</SelectItem>
            <SelectItem value="price-asc">Price (low → high)</SelectItem>
          </FilterSelect>
          {filtersActive && (
            <Button variant="outline" size="sm" onClick={clearFilters}><FilterX className="size-3.5" />Clear</Button>
          )}
        </SearchFilterBar>

        {/* Results count */}
        {!isLoading && !error && (
          <div style={{ fontSize: 11.5, color: T3 }}>
            {visibleCount} {visibleCount === 1 ? "service" : "services"}{filtersActive ? " match your filters" : ""}
          </div>
        )}

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ flex: 1 }}><ErrorState message="Failed to load services." onRetry={() => mutate()} /></div>
        ) : visibleCount === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {filtersActive ? (
              <EmptyState
                icon={Package}
                title="No matching services"
                description="No services match the current filters. Try clearing them to see everything."
                action={<Button variant="outline" size="sm" onClick={clearFilters}><FilterX className="size-3.5" />Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={Package}
                title="No services yet"
                description="Add predefined services for quick-add when creating invoices and quotations."
                action={<Button size="sm" onClick={openNew}><Plus className="size-4" />Add first service</Button>}
              />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {grouped.map(([cat, svcs]) => (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T3, marginBottom: 10 }}>
                  {cat} <span style={{ color: "var(--glass-border-strong)" }}>·</span> {svcs.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
                  {svcs.map(s => (
                    <div key={s._id} className="glass-card" style={{ padding: "18px 20px", position: "relative", opacity: s.is_active ? 1 : 0.62 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: T1, flex: 1 }}>{s.name}</div>
                        {s.unit && (
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(99,102,241,0.12)", color: AC2, border: "0.5px solid rgba(99,102,241,0.22)", flexShrink: 0 }}>{s.unit}</span>
                        )}
                      </div>
                      {s.description && (
                        <div style={{ fontSize: 11.5, color: T3, marginBottom: 12, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.description}</div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: AC2 }}>{formatCurrency(s.default_price, s.currency)}</div>
                        {!s.is_active && (
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 100, background: "var(--glass)", color: T3, border: `0.5px solid ${GLASS_BORDER}` }}>Inactive</span>
                        )}
                      </div>
                      <div className="svc-actions" style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }}>
                        <IconAction tooltip="Edit" onClick={() => openEdit(s)} style={{ width: 24, height: 24 }}>
                          <Pencil className="size-3" />
                        </IconAction>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <IconAction variant="danger" tooltip="Delete" style={{ width: 24, height: 24 }}>
                              <Trash2 className="size-3" />
                            </IconAction>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete service?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: T2 }}>
                                &ldquo;{s.name}&rdquo; will be permanently removed. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del(s._id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ServiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        service={editSvc}
        categories={CATEGORIES}
        units={UNITS}
        onSaved={() => mutate()}
      />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .glass-card:hover .svc-actions{opacity:1!important}`}</style>
    </div>
  );
}
