"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE } from "@/lib/ds";
import { SpinnerCenter } from "@/components/loaders";
import { useIsMobile } from "@/hooks/use-mobile";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import type { Customer, Expense } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

interface ExpItem { id: number; name: string; quantity: number; unit_price: number; category: string; }

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();

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
    // `hydrated` is used as a "run once" guard — intentionally excluded from deps
    // so SWR revalidations don't wipe edits the user has already made.
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
  }, [expense]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const cellInput = { padding: "6px 9px", fontSize: 11.5 } as const;

  if (loadingExp || !hydrated) return <SpinnerCenter height={300} />;

  const itemsCols = "minmax(150px,1fr) 128px 52px 96px 84px 26px";

  const summaryCard = (
    <div style={{ borderRadius: 12, border: `0.5px solid ${GLASS_BORDER}`, padding: "14px 16px", background: "var(--glass)", display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: T3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Summary</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T2 }}>
        <span>Subtotal</span><span>{formatCurrency(subTotal, currency)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 84px", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T2 }}>Tax (%)</span>
        <Input type="number" min="0" value={tax} onChange={(e) => setTax(e.target.value)} className="h-7 text-xs text-right" />
        <span style={{ fontSize: 11.5, color: T2, textAlign: "right" }}>{formatCurrency(taxAmt, currency)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 84px", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T2 }}>Discount</span>
        <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-7 text-xs text-right" />
        <span style={{ fontSize: 11.5, color: T2, textAlign: "right" }}>−{formatCurrency(parseFloat(discount || "0"), currency)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 17, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 10, marginTop: 3 }}>
        <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(total, currency)}</span>
      </div>
      <div style={{ fontSize: 11, color: T3 }}>{items.length} item{items.length !== 1 ? "s" : ""}</div>
    </div>
  );

  const formActions = (
    <div style={{ display: "flex", gap: 8 }}>
      <Button loading={loading} onClick={save} style={{ flex: 1 }}>Save changes</Button>
      <Button asChild variant="outline"><Link href={`/expenses/${id}`}>Cancel</Link></Button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={{ ...TOPBAR_STYLE, flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 6 : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link
            href={`/expenses/${id}`}
            style={{
              display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
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
        <Button loading={loading} onClick={save} size="sm">Save changes</Button>
      </div>

      {/* Body — natural scroll; centered two-pane (form + sticky summary rail) */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "22px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, alignItems: "flex-start" }}>

          {/* LEFT: form */}
          <div style={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Details */}
            <div>
              <div style={secTitle}>Expense details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div>
                  <label style={lbl}>Client *</label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(customers as Customer[]).map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 9 }}>
                  <div><label style={lbl}>Bill date</label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
                  <div>
                    <label style={lbl}>Currency</label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {["PKR", "USD", "EUR", "GBP", "AED"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 9 }}>
                  <div><label style={lbl}>Vendor name</label><Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor or supplier" /></div>
                  <div><label style={lbl}>Bill / Invoice #</label><Input value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="BILL-001" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 9 }}>
                  <div>
                    <label style={lbl}>Payment method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {[["cash", "Cash"], ["bank_transfer", "Bank transfer"], ["card", "Card"], ["cheque", "Cheque"], ["online", "Online"]].map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label style={lbl}>Payment status</label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
                    padding: "3px 11px", borderRadius: 100, cursor: "pointer",
                  }}
                >
                  + Add row
                </button>
              </div>
              <div style={{ borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 576 }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: itemsCols,
                      gap: 8, padding: "8px 12px",
                      fontSize: 10, fontWeight: 500, letterSpacing: "0.05em",
                      textTransform: "uppercase", color: T3,
                      background: "var(--glass)",
                    }}>
                      <span>Description</span>
                      <span>Category</span>
                      <span style={{ textAlign: "center" }}>Qty</span>
                      <span style={{ textAlign: "right" }}>Unit price</span>
                      <span style={{ textAlign: "right" }}>Total</span>
                      <span />
                    </div>
                    {items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: "grid", gridTemplateColumns: itemsCols,
                          gap: 8, padding: "9px 12px",
                          borderTop: `0.5px solid var(--glass-border)`,
                          alignItems: "center",
                        }}
                      >
                        <Input
                          value={item.name}
                          onChange={e => upd(item.id, "name", e.target.value)}
                          placeholder="Item description"
                          style={cellInput}
                        />
                        <Select value={item.category} onValueChange={val => upd(item.id, "category", val)}>
                          <SelectTrigger className="w-full" style={{ fontSize: 11.5 }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c} style={{ fontSize: 11.5 }}>{c}</SelectItem>)}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number" min="0" value={item.quantity}
                          onChange={e => upd(item.id, "quantity", e.target.value)}
                          style={{ ...cellInput, padding: "6px 6px", textAlign: "center" }}
                        />
                        <Input
                          type="number" min="0" value={item.unit_price}
                          onChange={e => upd(item.id, "unit_price", e.target.value)}
                          style={{ ...cellInput, textAlign: "right" }}
                        />
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T1, textAlign: "right" }}>
                          {formatCurrency(item.quantity * item.unit_price, currency)}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          title="Remove row"
                          style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: items.length === 1 ? "default" : "pointer", color: items.length === 1 ? "var(--glass-border-strong)" : T3, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 3l10 10M13 3L3 13"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={secTitle}>Notes</div>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional notes..."
                className="resize-none text-sm"
                style={{ height: 72 }}
              />
            </div>

            {/* Mobile: summary + actions inline (desktop uses the right rail) */}
            {isMobile && (
              <>
                {summaryCard}
                {formActions}
              </>
            )}
          </div>

          {/* RIGHT: sticky summary rail (desktop only) */}
          {!isMobile && (
            <aside style={{ width: 320, flexShrink: 0, position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {summaryCard}
              {formActions}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
