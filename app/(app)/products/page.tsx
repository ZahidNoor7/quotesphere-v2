"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Package, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS_BORDER, TOPBAR_STYLE, ICON_PILL } from "@/lib/ds";
import type { Product } from "@/types";
import { ErrorState } from "@/components/shared/error-state";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

const CATEGORIES = ["General", "Electronics", "Hardware", "Stationery", "Furniture", "Tools", "Consumables", "Apparel", "Food & Beverage", "Other"];
const UNITS = ["pcs", "units", "kg", "g", "L", "mL", "m", "cm", "box", "pack", "set", "pair", "roll", "sheet"];

function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  const isLow = qty <= threshold;
  const isOut = qty === 0;
  if (isOut) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "rgba(248,113,113,0.13)", color: "#f87171", border: "0.5px solid rgba(248,113,113,0.3)", fontWeight: 500 }}>
      Out of stock
    </span>
  );
  if (isLow) return (
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

function ProductForm({ initial, onSave, onClose }: { initial?: Product; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    sku: initial?.sku ?? "",
    category: initial?.category ?? "General",
    description: initial?.description ?? "",
    unit: initial?.unit ?? "pcs",
    default_price: initial?.default_price?.toString() ?? "",
    stock_qty: initial?.stock_qty?.toString() ?? "0",
    low_stock_threshold: initial?.low_stock_threshold?.toString() ?? "5",
  });
  const [loading, setLoading] = useState(false);
  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  async function save() {
    if (!form.name.trim()) { toast.error("Product name is required."); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        default_price: parseFloat(form.default_price) || 0,
        stock_qty: parseInt(form.stock_qty) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        sku: form.sku.trim() || undefined,
      };
      const res = await fetch(initial ? `/api/products/${initial._id}` : "/api/products", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(initial ? "Product updated." : "Product added.");
      onSave();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
        <div>
          <label style={lbl}>Product name *</label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. USB-C Hub 7-port" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>SKU</label>
            <Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. USB-HUB-7P" />
          </div>
          <div>
            <label style={lbl}>Category</label>
            <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Unit</label>
            <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          <div>
            <label style={lbl}>Default price (PKR)</label>
            <Input type="number" min="0" value={form.default_price} onChange={e => setForm(p => ({ ...p, default_price: e.target.value }))} placeholder="0" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Stock quantity</label>
            <Input type="number" min="0" value={form.stock_qty} onChange={e => setForm(p => ({ ...p, stock_qty: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>Low stock alert at</label>
            <Input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(p => ({ ...p, low_stock_threshold: e.target.value }))} placeholder="5" />
          </div>
        </div>

        <div>
          <label style={lbl}>Description</label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description" />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>{loading ? "Saving…" : (initial ? "Save changes" : "Add product")}</Button>
      </div>
    </>
  );
}

function StockAdjustDialog({ product, onDone, onClose }: { product: Product; onDone: () => void; onClose: () => void }) {
  const [delta, setDelta] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [loading, setLoading] = useState(false);

  async function apply() {
    const n = parseInt(delta);
    if (!n || n <= 0) { toast.error("Enter a valid quantity."); return; }
    const newQty = mode === "add" ? product.stock_qty + n : Math.max(0, product.stock_qty - n);
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_qty: newQty }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Stock updated to ${newQty} ${product.unit}.`);
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update stock.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 6 }}>
        <div style={{ fontSize: 13, color: T2 }}>
          Current stock: <strong style={{ color: T1 }}>{product.stock_qty} {product.unit}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Label style={{ fontSize: 12, color: T3 }}>Remove</Label>
          <Switch checked={mode === "add"} onCheckedChange={c => setMode(c ? "add" : "remove")} />
          <Label style={{ fontSize: 12, color: T3 }}>Add</Label>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" }}>Quantity to {mode}</label>
          <Input type="number" min="1" value={delta} onChange={e => setDelta(e.target.value)} placeholder="e.g. 10" autoFocus />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={apply}>{loading ? "Saving…" : "Apply"}</Button>
      </div>
    </>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  const swrKey = `/api/products?${search ? `search=${encodeURIComponent(search)}&` : ""}${filterLowStock ? "low_stock=true" : ""}`;
  const { data: products = [], mutate, isLoading, error } = useSWR<Product[]>(swrKey, fetcher);

  async function del(id: string) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    toast.success("Product deleted.");
    mutate();
  }

  const grouped = (products as Product[]).reduce((acc: Record<string, Product[]>, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const allProducts = products as Product[];
  const lowStockCount  = allProducts.filter(p => p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold).length;
  const outOfStockCount = allProducts.filter(p => p.stock_qty === 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={15} style={{ color: AC2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Products catalog</div>
          {lowStockCount > 0 && !filterLowStock && (
            <button
              onClick={() => setFilterLowStock(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, padding: "2px 8px", borderRadius: 100, background: "rgba(251,191,36,0.13)", color: "#fbbf24", border: "0.5px solid rgba(251,191,36,0.3)", cursor: "pointer", fontWeight: 500 }}
            >
              <AlertTriangle size={9} /> {lowStockCount} low stock
            </button>
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {filterLowStock && (
            <Button variant="outline" size="sm" onClick={() => setFilterLowStock(false)}>Clear filter</Button>
          )}
          <Button onClick={() => { setEditProduct(null); setShowForm(true); }} size="sm">
            <Plus size={13} style={{ marginRight: 4 }} />Add product
          </Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Stock summary strip */}
        {!isLoading && allProducts.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Total products", value: allProducts.length, color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
              { label: "Low stock",      value: lowStockCount,      color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)", onClick: () => setFilterLowStock(true) },
              { label: "Out of stock",   value: outOfStockCount,    color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
            ].map(({ label, value, color, bg, border, onClick }) => (
              <div
                key={label}
                onClick={onClick}
                style={{ padding: "8px 16px", borderRadius: 10, background: bg, border: `0.5px solid ${border}`, display: "flex", alignItems: "center", gap: 8, cursor: onClick ? "pointer" : "default" }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
                <span style={{ fontSize: 11, color, opacity: 0.8 }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or description…"
          style={{ maxWidth: 340, borderRadius: 100 }}
        />

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ flex: 1 }}><ErrorState message="Failed to load products." onRetry={() => mutate()} /></div>
        ) : (products as Product[]).length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Package size={32} style={{ color: T3, opacity: 0.4 }} />
            <div style={{ fontSize: 13, color: T2 }}>{filterLowStock ? "No low-stock products" : "No products yet"}</div>
            <div style={{ fontSize: 12, color: T3 }}>
              {filterLowStock ? "All products are sufficiently stocked." : "Add physical products with SKUs and stock tracking"}
            </div>
            {!filterLowStock && (
              <Button onClick={() => setShowForm(true)} size="sm" style={{ marginTop: 4 }}>
                <Plus size={12} style={{ marginRight: 4 }} />Add first product
              </Button>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.entries(grouped).map(([cat, prods]) => (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T3, marginBottom: 10 }}>{cat}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
                  {prods.map(p => (
                    <div key={p._id} className="glass-card product-card" style={{ padding: "14px 16px", position: "relative", transition: "all 0.2s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = GLASS_BORDER; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                    >
                      {/* Header row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T1, flex: 1, marginRight: 8, lineHeight: 1.3 }}>{p.name}</div>
                        <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 100, background: "rgba(99,102,241,0.12)", color: AC2, border: "0.5px solid rgba(99,102,241,0.22)", flexShrink: 0 }}>{p.unit}</span>
                      </div>

                      {/* SKU */}
                      {p.sku && <div style={{ fontSize: 10.5, color: T3, marginBottom: 6, fontFamily: "monospace", letterSpacing: "0.04em" }}>{p.sku}</div>}

                      {/* Description */}
                      {p.description && (
                        <div style={{ fontSize: 11, color: T3, marginBottom: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {p.description}
                        </div>
                      )}

                      {/* Price */}
                      <div style={{ fontSize: 16, fontWeight: 700, color: AC2, marginBottom: 8 }}>{formatCurrency(p.default_price)}</div>

                      {/* Stock row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StockBadge qty={p.stock_qty} threshold={p.low_stock_threshold} />
                          <span style={{ fontSize: 11, color: T3 }}>{p.stock_qty} {p.unit}</span>
                        </div>
                        <button
                          onClick={() => setStockProduct(p)}
                          style={{ fontSize: 10, color: AC2, background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 6, padding: "2px 7px", cursor: "pointer" }}
                          title="Adjust stock"
                        >± stock</button>
                      </div>

                      {/* Actions overlay */}
                      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }} className="prod-actions">
                        <button style={{ ...ICON_PILL, width: 22, height: 22 }} onClick={() => { setEditProduct(p); setShowForm(true); }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2L5 13l-3 1 1-3z"/></svg>
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button style={{ ...ICON_PILL, width: 22, height: 22 }}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete product?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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

      {/* Add / Edit dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setEditProduct(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editProduct ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          <ProductForm
            initial={editProduct ?? undefined}
            onSave={() => { setShowForm(false); setEditProduct(null); mutate(); }}
            onClose={() => { setShowForm(false); setEditProduct(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Stock adjust dialog */}
      <Dialog open={!!stockProduct} onOpenChange={open => { if (!open) setStockProduct(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock — {stockProduct?.name}</DialogTitle></DialogHeader>
          {stockProduct && (
            <StockAdjustDialog
              product={stockProduct}
              onDone={() => { setStockProduct(null); mutate(); }}
              onClose={() => setStockProduct(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .glass-card { cursor: default; }
        .glass-card:hover .prod-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
