"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, FIELD_INPUT } from "@/lib/ds";
import { SpinnerCenter } from "@/components/loaders";
import type { Customer, Expense } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

interface ExpItem { id: number; name: string; quantity: number; unit_price: number; category: string; }
const CATEGORIES = ["Materials", "Labour", "Transport", "Equipment", "Software", "Office", "Other"];

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: expense, isLoading: loadingExp } = useSWR<Expense>(`/api/expenses/${id}`, fetcher);
  const { data: customers = [] } = useSWR<Customer[]>("/api/customers?limit=200", fetcher);

  const [hydrated, setHydrated] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [currency, setCurrency] = useState("PKR");
  const [tax, setTax] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ExpItem[]>([{ id: 1, name: "", quantity: 1, unit_price: 0, category: "Materials" }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expense || hydrated) return;
    setCustomerId(expense.customer_id);
    setBillDate(expense.bill_date.slice(0, 10));
    setVendorName(expense.vendor_name ?? "");
    setBillNumber(expense.bill_number ?? "");
    setPaymentMethod(expense.payment_method ?? "cash");
    setPaymentStatus(expense.payment_status ?? "pending");
    setCurrency(expense.currency);
    setTax(String(expense.tax ?? 0));
    setDiscount(String(expense.discount ?? 0));
    setNotes(expense.notes ?? "");
    setItems(expense.items.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      category: i.category ?? "Materials",
    })));
    setHydrated(true);
  }, [expense, hydrated]);

  const customer = (customers as Customer[]).find(c => c._id === customerId);
  const subTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmt = (subTotal * parseFloat(tax || "0")) / 100;
  const total = subTotal + taxAmt - parseFloat(discount || "0");

  function addItem() { setItems(p => [...p, { id: Date.now(), name: "", quantity: 1, unit_price: 0, category: "Materials" }]); }
  function removeItem(itemId: number) { if (items.length > 1) setItems(p => p.filter(i => i.id !== itemId)); }
  function upd(itemId: number, k: keyof ExpItem, v: string | number) {
    setItems(p => p.map(i =>
      i.id === itemId
        ? { ...i, [k]: typeof v === "string" && k !== "name" && k !== "category" ? parseFloat(v) || 0 : v }
        : i
    ));
  }

  async function save() {
    if (!customerId) { toast.error("Please select a client."); return; }
    if (items.some(i => !i.name)) { toast.error("All items need a description."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bill_date: new Date(billDate),
          vendor_name: vendorName || undefined,
          bill_number: billNumber || undefined,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          items: items.map(i => ({ ...i, total: i.quantity * i.unit_price })),
          sub_total: subTotal,
          tax: parseFloat(tax || "0"),
          tax_type: "percentage",
          discount: parseFloat(discount || "0"),
          total_amount: total,
          currency,
          notes,
          customer_id: customerId,
          customer_name: customer?.name ?? expense?.customer_name ?? "",
          customer_phone: customer?.phone_no ?? expense?.customer_phone ?? "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Expense updated.");
      router.push(`/expenses/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update.");
    } finally {
      setLoading(false);
    }
  }

  const lbl = { fontSize: 10.5, color: T3, fontWeight: 500, marginBottom: 3, display: "block" } as const;
  const secTitle = {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase" as const, color: T3,
    marginBottom: 10, paddingBottom: 6, borderBottom: `0.5px solid ${GLASS_BORDER}`,
  };

  if (loadingExp || !hydrated) return <SpinnerCenter height={300} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Link
            href={`/expenses/${id}`}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 100,
              background: GLASS, border: `0.5px solid ${GLASS_BORDER}`,
              color: T2, fontSize: 11.5, textDecoration: "none",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M8 2L4 6l4 4"/>
            </svg>
            {expense?.expense_no}
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>Edit expense</div>
        </div>
        <Button loading={loading} onClick={save}>Save changes</Button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", maxWidth: 700 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Details */}
          <div>
            <div style={secTitle}>Expense details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div>
                <label style={lbl}>Client *</label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                  <option value="">Select client</option>
                  {(customers as Customer[]).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div><label style={lbl}>Bill date</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={FIELD_INPUT} /></div>
                <div>
                  <label style={lbl}>Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                    {["PKR", "USD", "EUR", "GBP", "AED"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div><label style={lbl}>Vendor name</label><input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor or supplier" style={FIELD_INPUT} /></div>
                <div><label style={lbl}>Bill / Invoice #</label><input value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="BILL-001" style={FIELD_INPUT} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div>
                  <label style={lbl}>Payment method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                    {[["cash", "Cash"], ["bank_transfer", "Bank transfer"], ["card", "Card"], ["cheque", "Cheque"], ["online", "Online"]].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Payment status</label>
                  <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div style={{ ...secTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Expense items</span>
              <button
                onClick={addItem}
                style={{
                  fontSize: 11, color: AC2,
                  background: "rgba(99,102,241,0.11)",
                  border: `0.5px solid rgba(99,102,241,0.22)`,
                  padding: "2px 10px", borderRadius: 100, cursor: "pointer",
                }}
              >
                + Add row
              </button>
            </div>
            <div style={{ borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "3fr 52px 85px 75px 26px",
                gap: 5, padding: "6px 10px",
                fontSize: 9.5, fontWeight: 500, letterSpacing: "0.05em",
                textTransform: "uppercase", color: T3,
                background: "rgba(255,255,255,0.025)",
              }}>
                <span>Description</span>
                <span style={{ textAlign: "center" }}>Qty</span>
                <span style={{ textAlign: "right" }}>Unit price</span>
                <span style={{ textAlign: "right" }}>Total</span>
                <span />
              </div>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: "grid", gridTemplateColumns: "3fr 52px 85px 75px 26px",
                    gap: 5, padding: "6px 10px",
                    borderTop: `0.5px solid rgba(255,255,255,0.04)`,
                    alignItems: "center",
                  }}
                >
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
                  <input
                    type="number" min="0" value={item.quantity}
                    onChange={e => upd(item.id, "quantity", e.target.value)}
                    style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 5px", color: T1, fontSize: 11, width: "100%", outline: "none", textAlign: "center" }}
                  />
                  <input
                    type="number" min="0" value={item.unit_price}
                    onChange={e => upd(item.id, "unit_price", e.target.value)}
                    style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 7px", color: T1, fontSize: 11, width: "100%", outline: "none", textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 500, color: T1, textAlign: "right" }}>
                    {formatCurrency(item.quantity * item.unit_price, currency)}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    style={{ width: 22, height: 22, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: items.length === 1 ? "rgba(255,255,255,0.1)" : T3, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3l10 10M13 3L3 13"/>
                    </svg>
                  </button>
                </div>
              ))}
              <div style={{ padding: "10px 14px", borderTop: `0.5px solid ${GLASS_BORDER}`, background: "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                  <span>Subtotal</span><span>{formatCurrency(subTotal, currency)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: T2 }}>Tax (%)</span>
                  <input
                    type="number" min="0" value={tax}
                    onChange={e => setTax(e.target.value)}
                    style={{ width: 60, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "3px 6px", color: T1, fontSize: 11, outline: "none", textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11, color: T2, minWidth: 80, textAlign: "right" }}>{formatCurrency(taxAmt, currency)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11.5, color: T2 }}>Discount</span>
                  <input
                    type="number" min="0" value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    style={{ width: 60, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "3px 6px", color: T1, fontSize: 11, outline: "none", textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11, color: T2, minWidth: 80, textAlign: "right" }}>−{formatCurrency(parseFloat(discount || "0"), currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div style={secTitle}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes..."
              style={{ ...FIELD_INPUT, resize: "none", height: 68, fontSize: 12 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button loading={loading} onClick={save}>Save changes</Button>
            <Button asChild variant="outline"><Link href={`/expenses/${id}`}>Cancel</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
