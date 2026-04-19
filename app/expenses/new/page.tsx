"use client";
import { useState, memo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE } from "@/lib/ds";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Customer } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

interface ExpItem { id: number; name: string; quantity: number; unit_price: number; category: string; }
const CATEGORIES = ["Materials", "Labour", "Transport", "Equipment", "Software", "Office", "Other"];
const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED"];
const PAYMENT_METHODS: [string, string][] = [
  ["cash", "Cash"], ["bank_transfer", "Bank Transfer"], ["card", "Card"],
  ["cheque", "Cheque"], ["online", "Online"],
];

// ── Mobile item card ─────────────────────────────────────────────────────────

interface MobileExpItemCardProps {
  item: ExpItem;
  idx: number;
  currency: string;
  disableRemove: boolean;
  onUpdate: (id: number, k: keyof ExpItem, v: string | number) => void;
  onRemove: (id: number) => void;
}

const MobileExpItemCard = memo(function MobileExpItemCard({ item, idx, currency, disableRemove, onUpdate, onRemove }: MobileExpItemCardProps) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unit_price));

  useEffect(() => { setName(item.name); }, [item.name]);
  useEffect(() => { setQty(String(item.quantity)); }, [item.quantity]);
  useEffect(() => { setPrice(String(item.unit_price)); }, [item.unit_price]);

  const localTotal = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  return (
    <div style={{ background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 12, padding: 12 }}>
      {/* Header: item # + remove */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: T3, fontWeight: 600, flex: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>Item {idx + 1}</span>
        <button
          onClick={() => onRemove(item.id)}
          disabled={disableRemove}
          style={{ width: 26, height: 26, borderRadius: 7, background: disableRemove ? "none" : "rgba(248,113,113,0.1)", border: disableRemove ? "none" : "0.5px solid rgba(248,113,113,0.25)", cursor: disableRemove ? "default" : "pointer", color: disableRemove ? "rgba(255,255,255,0.15)" : "#f87171", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
        >
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
        </button>
      </div>

      {/* Description */}
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => onUpdate(item.id, "name", name)}
        placeholder="Item description"
        className="h-9 text-sm mb-2"
      />

      {/* Category */}
      <Select value={item.category} onValueChange={v => onUpdate(item.id, "category", v)}>
        <SelectTrigger className="h-8 text-xs mb-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Qty + Price */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: T3, fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Qty</div>
          <Input
            type="number" min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onBlur={() => onUpdate(item.id, "quantity", qty)}
            className="h-9 text-sm text-center"
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: T3, fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Unit price</div>
          <Input
            type="number" min="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={() => onUpdate(item.id, "unit_price", price)}
            className="h-9 text-sm text-right"
          />
        </div>
      </div>

      {/* Total */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, color: T3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{formatCurrency(localTotal, currency)}</span>
      </div>
    </div>
  );
});

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewExpensePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { data: customers = [] } = useSWR<Customer[]>("/api/customers?limit=200", fetcher);

  const [customerId, setCustomerId] = useState(searchParams.get("customer_id") ?? "");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [currency, setCurrency] = useState("PKR");
  const [tax, setTax] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ExpItem[]>([{ id: 1, name: "", quantity: 1, unit_price: 0, category: "Materials" }]);
  const [loading, setLoading] = useState(false);

  const customer = (customers as Customer[]).find(c => c._id === customerId);
  const subTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmt = (subTotal * parseFloat(tax || "0")) / 100;
  const total = subTotal + taxAmt - parseFloat(discount || "0");

  function addItem() { setItems(p => [...p, { id: Date.now(), name: "", quantity: 1, unit_price: 0, category: "Materials" }]); }
  function removeItem(id: number) { if (items.length > 1) setItems(p => p.filter(i => i.id !== id)); }
  function upd(id: number, k: keyof ExpItem, v: string | number) {
    setItems(p => p.map(i => i.id === id
      ? { ...i, [k]: typeof v === "string" && k !== "name" && k !== "category" ? parseFloat(v) || 0 : v }
      : i
    ));
  }

  async function save() {
    if (!customerId) { toast.error("Please select a client."); return; }
    if (items.some(i => !i.name)) { toast.error("All items need a description."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bill_date: new Date(billDate), vendor_name: vendorName || undefined, bill_number: billNumber || undefined,
          status: "recorded", payment_method: paymentMethod, payment_status: "pending",
          items: items.map(i => ({ ...i, total: i.quantity * i.unit_price })),
          sub_total: subTotal, tax: parseFloat(tax || "0"), tax_type: "percentage",
          discount: parseFloat(discount || "0"), total_amount: total, currency, notes,
          customer_id: customerId, customer_name: customer?.name ?? "", customer_phone: customer?.phone_no ?? "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Expense recorded.");
      router.push("/expenses");
    } catch (err: any) { toast.error(err.message || "Failed."); }
    finally { setLoading(false); }
  }

  const lbl = { fontSize: 10.5, color: T3, fontWeight: 500, marginBottom: 3, display: "block" } as const;
  const secTitle = {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase" as const, color: T3,
    marginBottom: 10, paddingBottom: 6, borderBottom: `0.5px solid ${GLASS_BORDER}`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={{ ...TOPBAR_STYLE, flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 6 : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link
            href="/expenses"
            style={{
              display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              padding: isMobile ? 0 : "5px 11px",
              width: isMobile ? 30 : undefined, height: isMobile ? 30 : undefined,
              justifyContent: isMobile ? "center" : undefined,
              borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`,
              color: T2, fontSize: 11.5, textDecoration: "none",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4" /></svg>
            {!isMobile && "Expenses"}
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Record expense</div>
          {!isMobile && (
            <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", background: "rgba(248,113,113,0.15)", color: "#f87171", border: "0.5px solid rgba(248,113,113,0.3)", flexShrink: 0 }}>
              EXPENSE
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", ...(isMobile ? { width: "100%" } : {}) }}>
          <Button loading={loading} onClick={save} style={isMobile ? { flex: 1 } : undefined}>Save expense</Button>
          {!isMobile && <Button asChild variant="outline"><Link href="/expenses">Cancel</Link></Button>}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "18px 20px", maxWidth: 700, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Details ── */}
          <div>
            <div style={secTitle}><span>Expense details</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Client */}
              <div>
                <label style={lbl}>Client *</label>
                <Select value={customerId || "_none"} onValueChange={v => setCustomerId(v === "_none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Select client</SelectItem>
                    {(customers as Customer[]).map(c => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bill date + Currency */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Bill date</label>
                  <DatePickerInput value={billDate} onChange={setBillDate} />
                </div>
                <div>
                  <label style={lbl}>Currency</label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Vendor + Bill # */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Vendor name</label>
                  <Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor or supplier" />
                </div>
                <div>
                  <label style={lbl}>Bill / Invoice #</label>
                  <Input value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="BILL-001" />
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label style={lbl}>Payment method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Items ── */}
          <div>
            <div style={secTitle}>
              <span>Expense items</span>
              <button
                onClick={addItem}
                style={{ fontSize: 11, color: AC2, background: "rgba(99,102,241,0.11)", border: `0.5px solid rgba(99,102,241,0.22)`, padding: "2px 10px", borderRadius: 100, cursor: "pointer" }}
              >
                + Add row
              </button>
            </div>

            {isMobile ? (
              /* Mobile cards */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((item, idx) => (
                  <MobileExpItemCard
                    key={item.id}
                    item={item}
                    idx={idx}
                    currency={currency}
                    disableRemove={items.length === 1}
                    onUpdate={upd}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            ) : (
              /* Desktop table */
              <div style={{ borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "3fr 52px 85px 75px 26px", gap: 5, padding: "6px 10px", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: T3, background: "rgba(255,255,255,0.025)" }}>
                  <span>Description</span>
                  <span style={{ textAlign: "center" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Unit price</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                  <span />
                </div>
                {items.map(item => (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 52px 85px 75px 26px", gap: 5, padding: "6px 10px", borderTop: `0.5px solid rgba(255,255,255,0.04)`, alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <input
                        value={item.name}
                        onChange={e => upd(item.id, "name", e.target.value)}
                        placeholder="Item description"
                        style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 7px", color: T1, fontSize: 11, width: "100%", outline: "none" }}
                      />
                      <select
                        value={item.category}
                        onChange={e => upd(item.id, "category", e.target.value)}
                        style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 5px", color: T3, fontSize: 10, outline: "none" }}
                      >
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <input type="number" min="0" value={item.quantity} onChange={e => upd(item.id, "quantity", e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 5px", color: T1, fontSize: 11, width: "100%", outline: "none", textAlign: "center" }} />
                    <input type="number" min="0" value={item.unit_price} onChange={e => upd(item.id, "unit_price", e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 7px", color: T1, fontSize: 11, width: "100%", outline: "none", textAlign: "right" }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: T1, textAlign: "right" }}>{formatCurrency(item.quantity * item.unit_price, currency)}</span>
                    <button onClick={() => removeItem(item.id)} disabled={items.length === 1} style={{ width: 22, height: 22, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: items.length === 1 ? "rgba(255,255,255,0.1)" : T3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div style={{ marginTop: 10, borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, padding: "10px 14px", background: "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                <span>Subtotal</span>
                <span>{formatCurrency(subTotal, currency)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: T2 }}>Tax (%)</span>
                <Input
                  type="number" min="0"
                  value={tax}
                  onChange={e => setTax(e.target.value)}
                  className="h-7 text-xs text-right"
                  style={{ width: 64 }}
                />
                <span style={{ fontSize: 11, color: T2, minWidth: 80, textAlign: "right" }}>{formatCurrency(taxAmt, currency)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: T2 }}>Discount</span>
                <Input
                  type="number" min="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className="h-7 text-xs text-right"
                  style={{ width: 64 }}
                />
                <span style={{ fontSize: 11, color: T2, minWidth: 80, textAlign: "right" }}>−{formatCurrency(parseFloat(discount || "0"), currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 2 }}>
                <span>Total</span>
                <span style={{ color: AC2 }}>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <div style={secTitle}><span>Notes</span></div>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes..."
              className="resize-none text-sm"
            />
          </div>

          {/* Bottom actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <Button loading={loading} onClick={save}>Save expense</Button>
            <Button asChild variant="outline"><Link href="/expenses">Cancel</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
