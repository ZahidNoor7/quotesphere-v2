"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Package, AlertTriangle, Plus, Pencil, Trash2, FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/dialog";
import { SearchFilterBar, FilterSelect, SelectItem } from "@/components/custom-ui/search-filter-bar";
import { IconAction } from "@/components/custom-ui/icon-action";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ProductSheet } from "@/components/products/product-sheet";
import { StockAdjustSheet } from "@/components/products/stock-adjust-sheet";

import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS_BORDER, TOPBAR_STYLE } from "@/lib/ds";
import type { Product } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data as Product[]);

const CATEGORIES = ["General", "Electronics", "Hardware", "Stationery", "Furniture", "Tools", "Consumables", "Apparel", "Food & Beverage", "Other"];
const UNITS = ["pcs", "units", "kg", "g", "L", "mL", "m", "cm", "box", "pack", "set", "pair", "roll", "sheet"];

type StatusFilter = "active" | "inactive" | "all";
type StockFilter = "all" | "in" | "low" | "out";
type SortKey = "name-asc" | "price-desc" | "price-asc" | "stock-asc" | "stock-desc";

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  "name-asc": (a, b) => a.name.localeCompare(b.name),
  "price-desc": (a, b) => b.default_price - a.default_price,
  "price-asc": (a, b) => a.default_price - b.default_price,
  "stock-asc": (a, b) => a.stock_qty - b.stock_qty,
  "stock-desc": (a, b) => b.stock_qty - a.stock_qty,
};

function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty === 0) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "rgba(248,113,113,0.13)", color: "#f87171", border: "0.5px solid rgba(248,113,113,0.3)", fontWeight: 500 }}>
      Out of stock
    </span>
  );
  if (qty <= threshold) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "rgba(251,191,36,0.13)", color: "#fbbf24", border: "0.5px solid rgba(251,191,36,0.3)", fontWeight: 500 }}>
      <AlertTriangle size={9} /> Low
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "rgba(52,211,153,0.12)", color: "#34d399", border: "0.5px solid rgba(52,211,153,0.28)", fontWeight: 500 }}>
      In stock
    </span>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("all");
  const [unit, setUnit] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<SortKey>("name-asc");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  // Debounce the (server-side) text search so we don't hit $text on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const key = `/api/products?status=${status}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`;
  const { data: products = [], mutate, isLoading, error } = useSWR<Product[]>(key, fetcher);

  const lowStockCount = products.filter(p => p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold).length;
  const outOfStockCount = products.filter(p => p.stock_qty === 0).length;

  const filtersActive = Boolean(debounced) || category !== "all" || unit !== "all" || stock !== "all" || status !== "active" || sort !== "name-asc";

  function clearFilters() {
    setSearch(""); setDebounced(""); setCategory("all"); setUnit("all"); setStock("all"); setStatus("active"); setSort("name-asc");
  }

  // Category / unit / stock filters and sort applied client-side; results grouped by category.
  const grouped = useMemo(() => {
    const filtered = products.filter(p => {
      if (category !== "all" && p.category !== category) return false;
      if (unit !== "all" && p.unit !== unit) return false;
      if (stock === "in" && !(p.stock_qty > p.low_stock_threshold)) return false;
      if (stock === "low" && !(p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold)) return false;
      if (stock === "out" && p.stock_qty !== 0) return false;
      return true;
    });
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    for (const arr of map.values()) arr.sort(SORTERS[sort]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [products, category, unit, stock, sort]);

  const visibleCount = grouped.reduce((n, [, arr]) => n + arr.length, 0);

  async function del(id: string) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not delete product");
      toast.success("Product deleted.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete product");
    }
  }

  function openNew() { setEditProduct(null); setSheetOpen(true); }
  function openEdit(p: Product) { setEditProduct(p); setSheetOpen(true); }

  const summary = [
    { label: "Total", value: products.length, color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)", onClick: () => setStock("all") },
    { label: "Low stock", value: lowStockCount, color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", onClick: () => setStock("low") },
    { label: "Out of stock", value: outOfStockCount, color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)", onClick: () => setStock("out") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={15} style={{ color: AC2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Products catalog</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={openNew} size="sm"><Plus className="size-4" />Add product</Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Stock summary strip */}
        {!isLoading && !error && products.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {summary.map(({ label, value, color, bg, border, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                style={{ padding: "14px 22px", borderRadius: 14, background: bg, border: `0.5px solid ${border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", minWidth: 150 }}
              >
                <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: 13, color, opacity: 0.85 }}>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <SearchFilterBar search={search} onSearch={setSearch} searchPlaceholder="Search by name, SKU, or description…">
          <FilterSelect value={category} onValueChange={setCategory} placeholder="Category">
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </FilterSelect>
          <FilterSelect value={unit} onValueChange={setUnit} placeholder="Unit">
            <SelectItem value="all">All units</SelectItem>
            {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </FilterSelect>
          <FilterSelect value={stock} onValueChange={v => setStock(v as StockFilter)} placeholder="Stock">
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
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
            <SelectItem value="stock-asc">Stock (low → high)</SelectItem>
            <SelectItem value="stock-desc">Stock (high → low)</SelectItem>
          </FilterSelect>
          {filtersActive && (
            <Button variant="outline" size="sm" onClick={clearFilters}><FilterX className="size-3.5" />Clear</Button>
          )}
        </SearchFilterBar>

        {/* Results count */}
        {!isLoading && !error && (
          <div style={{ fontSize: 11.5, color: T3 }}>
            {visibleCount} {visibleCount === 1 ? "product" : "products"}{filtersActive ? " match your filters" : ""}
          </div>
        )}

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ flex: 1 }}><ErrorState message="Failed to load products." onRetry={() => mutate()} /></div>
        ) : visibleCount === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {filtersActive ? (
              <EmptyState
                icon={Package}
                title="No matching products"
                description="No products match the current filters. Try clearing them to see everything."
                action={<Button variant="outline" size="sm" onClick={clearFilters}><FilterX className="size-3.5" />Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Add physical products with SKUs and stock tracking for quick-add on invoices & quotations."
                action={<Button size="sm" onClick={openNew}><Plus className="size-4" />Add first product</Button>}
              />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {grouped.map(([cat, prods]) => (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T3, marginBottom: 10 }}>
                  {cat} <span style={{ color: "var(--glass-border-strong)" }}>·</span> {prods.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
                  {prods.map(p => (
                    <div key={p._id} className="glass-card prod-card" style={{ padding: "18px 20px", position: "relative", opacity: p.is_active ? 1 : 0.62 }}>
                      {/* Header row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: T1, flex: 1, lineHeight: 1.3 }}>{p.name}</div>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(99,102,241,0.12)", color: AC2, border: "0.5px solid rgba(99,102,241,0.22)", flexShrink: 0 }}>{p.unit}</span>
                      </div>

                      {p.sku && <div style={{ fontSize: 10.5, color: T3, marginBottom: 6, fontFamily: "monospace", letterSpacing: "0.04em" }}>{p.sku}</div>}

                      {p.description && (
                        <div style={{ fontSize: 11.5, color: T3, marginBottom: 10, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {p.description}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: AC2 }}>{formatCurrency(p.default_price, p.currency)}</div>
                        {!p.is_active && (
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 100, background: "var(--glass)", color: T3, border: `0.5px solid ${GLASS_BORDER}` }}>Inactive</span>
                        )}
                      </div>

                      {/* Stock row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StockBadge qty={p.stock_qty} threshold={p.low_stock_threshold} />
                          <span style={{ fontSize: 11, color: T3 }}>{p.stock_qty} {p.unit}</span>
                        </div>
                        <button
                          onClick={() => setStockProduct(p)}
                          style={{ fontSize: 10, color: AC2, background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                          title="Adjust stock"
                        >± stock</button>
                      </div>

                      {/* Actions overlay */}
                      <div className="prod-actions" style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }}>
                        <IconAction tooltip="Edit" onClick={() => openEdit(p)} style={{ width: 24, height: 24 }}>
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
                              <AlertDialogTitle>Delete product?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: T2 }}>
                                &ldquo;{p.name}&rdquo; will be permanently removed. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del(p._id)}>Delete</AlertDialogAction>
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

      <ProductSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        product={editProduct}
        categories={CATEGORIES}
        units={UNITS}
        onSaved={() => mutate()}
      />

      <StockAdjustSheet
        product={stockProduct}
        onOpenChange={open => { if (!open) setStockProduct(null); }}
        onDone={() => mutate()}
      />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .glass-card:hover .prod-actions{opacity:1!important}`}</style>
    </div>
  );
}
