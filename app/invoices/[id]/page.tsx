"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge, InvoiceStatusBadge } from "@/components/shared/status-badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, FIELD_INPUT, CARD, ICON_PILL } from "@/lib/ds";
import type { Invoice, PaymentMethod, PaymentEntry } from "@/types";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import { getDesignById, getDefaultDesign } from "@/lib/document-designs";
import { useSettings } from "@/hooks/use-settings";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card / POS" },
  { value: "online", label: "Online (JazzCash / Easypaisa)" },
  { value: "cheque", label: "Cheque" },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, mutate, isLoading } = useSWR<Invoice>(`/api/invoices/${id}`, fetcher);
  const { settings } = useSettings();
  const [showPayment, setShowPayment] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<PaymentEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), amount: "", method: "cash" as PaymentMethod, reference: "", note: "" });

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!invoice) return <div style={{ padding: 24, color: T3 }}>Invoice not found.</div>;

  const paidPct = invoice.total_amount > 0 ? Math.min(100, (invoice.total_paid / invoice.total_amount) * 100) : 0;
  const afterThis = form.amount ? Math.max(0, invoice.outstanding - parseFloat(form.amount || "0")) : invoice.outstanding;

  async function recordPayment() {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount."); return; }
    if (amount > invoice!.outstanding) { toast.error(`Exceeds outstanding balance of ${formatCurrency(invoice!.outstanding)}`); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Payment recorded."); mutate();
      setShowPayment(false);
      setForm({ date: new Date().toISOString().slice(0,10), amount: "", method: "cash", reference: "", note: "" });
    } catch (err: any) { toast.error(err.message || "Failed."); }
    finally { setSaving(false); }
  }

  async function deletePayment(paymentId: string) {
    await fetch(`/api/invoices/${id}/payments?paymentId=${paymentId}`, { method: "DELETE" });
    toast.success("Payment removed."); mutate();
  }

  const lbl = { fontSize: 10.5, color: T3, fontWeight: 500, marginBottom: 3, display: "block" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link href="/invoices" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, cursor: "pointer", textDecoration: "none" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4"/></svg>
            Invoices
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{invoice.invoice_no}</div>
          <InvoiceStatusBadge status={invoice.status} />
          <PaymentStatusBadge status={invoice.payment_status} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button asChild variant="outline" size="sm"><Link href={`/invoices/${id}/edit`}>Edit</Link></Button>
          {invoice.payment_status !== "complete" && (
            <Button size="sm" onClick={() => setShowPayment(true)}>+ Record payment</Button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 300px", gap: 0 }}>
        {/* Left: main content */}
        <div style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Collection progress */}
          <div style={{ ...CARD, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: T3 }}>Collection progress</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T1 }}>{Math.round(paidPct)}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ height: "100%", borderRadius: 4, transition: "width 0.5s", width: `${paidPct}%`, background: paidPct === 100 ? "#34d399" : paidPct > 50 ? "#6366f1" : "#fbbf24" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
              {[
                { label: "Invoice total", val: formatCurrency(invoice.total_amount, invoice.currency), color: T1 },
                { label: "Collected", val: formatCurrency(invoice.total_paid, invoice.currency), color: "#34d399" },
                { label: "Outstanding", val: formatCurrency(invoice.outstanding, invoice.currency), color: invoice.outstanding > 0 ? "#fbbf24" : "#34d399" },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div style={CARD}>
            <div style={{ padding: "12px 16px 8px", fontSize: 12, fontWeight: 500, color: T1 }}>Line items</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Description", "Qty", "Rate", "Total"].map(h => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: h === "Qty" || h === "Rate" || h === "Total" ? "right" : "left", fontSize: 10, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2, textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2, textAlign: "right" }}>{formatCurrency(item.price, invoice.currency)}</td>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 600, textAlign: "right" }}>{formatCurrency(item.price * item.quantity, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "10px 16px 12px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}><span>Subtotal</span><span>{formatCurrency(invoice.sub_total, invoice.currency)}</span></div>
              {invoice.tax > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}><span>Tax</span><span>{formatCurrency(invoice.tax_type === "percentage" ? invoice.sub_total * invoice.tax / 100 : invoice.tax, invoice.currency)}</span></div>}
              {invoice.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#34d399" }}><span>Discount</span><span>-{formatCurrency(invoice.discount, invoice.currency)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 4 }}>
                <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(invoice.total_amount, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment ledger */}
          <div style={CARD}>
            <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: T1 }}>Payment ledger</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: invoice.payments.length === 0 ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.15)", color: invoice.payments.length === 0 ? T3 : AC2, border: `0.5px solid ${invoice.payments.length === 0 ? GLASS_BORDER : "rgba(99,102,241,0.3)"}` }}>
                {invoice.payments.length} payment{invoice.payments.length !== 1 ? "s" : ""}
              </span>
            </div>
            {invoice.payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 20px", color: T3 }}>
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="0.8" style={{ display: "block", margin: "0 auto 8px", opacity: 0.4 }}><rect x="1" y="4" width="14" height="9" rx="1.5"/><path d="M1 7h14"/><circle cx="4.5" cy="10.5" r="1"/></svg>
                <div style={{ fontSize: 12, color: T2, marginBottom: 4 }}>No payments recorded yet</div>
                {invoice.payment_status !== "complete" && (
                  <button onClick={() => setShowPayment(true)} style={{ marginTop: 10, padding: "6px 14px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, cursor: "pointer" }}>Record first payment</button>
                )}
              </div>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                      {["Date", "Description / Ref", "Method", "Amount", ""].map(h => (
                        <th key={h} style={{ padding: "7px 12px", textAlign: h === "Amount" ? "right" : "left", fontSize: 10, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p, i) => (
                      <tr key={p._id || i}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = "rgba(255,255,255,0.02)"))}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = ""))}
                      >
                        <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3, whiteSpace: "nowrap" }}>{formatDate(p.date)}</td>
                        <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: T2 }}>{p.note || "Payment received"}</div>
                          {p.reference && <div style={{ fontSize: 10.5, color: T3 }}>Ref: {p.reference}</div>}
                        </td>
                        <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,0.06)", color: T2, border: `0.5px solid ${GLASS_BORDER}`, textTransform: "capitalize" }}>{p.method.replace("_", " ")}</span>
                        </td>
                        <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: "#34d399", fontWeight: 600, textAlign: "right" }}>+{formatCurrency(p.amount, invoice.currency)}</td>
                        <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setReceiptPayment(p)} style={{ ...ICON_PILL, width: 22, height: 22 }}
                              title="Print receipt"
                              onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(99,102,241,0.2)", color: "#818cf8", borderColor: "rgba(99,102,241,0.3)" })}
                              onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: GLASS, color: T2, borderColor: GLASS_BORDER })}
                            >
                              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5V2h8v3"/><rect x="2" y="5" width="12" height="7" rx="1"/><path d="M4 9h8M4 11h4"/></svg>
                            </button>
                            <button onClick={() => deletePayment(p._id)} style={{ ...ICON_PILL, width: 22, height: 22 }}
                              onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" })}
                              onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: GLASS, color: T2, borderColor: GLASS_BORDER })}
                            >
                              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      <td colSpan={3} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 500, color: T2 }}>Remaining balance</td>
                      <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: invoice.outstanding === 0 ? "#34d399" : "#fbbf24" }}>
                        {invoice.outstanding === 0 ? "✓ Paid in full" : formatCurrency(invoice.outstanding, invoice.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>

          {invoice.remarks && (
            <div style={{ ...CARD, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T3, marginBottom: 6 }}>REMARKS</div>
              <div style={{ fontSize: 13, color: T2, lineHeight: 1.6 }}>{invoice.remarks}</div>
            </div>
          )}
        </div>

        {/* Right: info panel */}
        <div style={{ borderLeft: `0.5px solid ${GLASS_BORDER}`, overflowY: "auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Client */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>Client</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{invoice.customer_name}</div>
            {invoice.customer_phone && <div style={{ fontSize: 12, color: T2, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 2h2.5l1 3-1.5 1.5s1 3.5 4.5 4.5L11 9.5l3 1V13a1 1 0 01-1 1C5 14 2 5 2 3a1 1 0 011-1z"/></svg>
              {invoice.customer_phone}
            </div>}
            {invoice.customer_address && <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>{invoice.customer_address}</div>}
            {invoice.customer_id && (
              <Link href={`/customers/${invoice.customer_id}`} style={{ display: "inline-block", marginTop: 10, fontSize: 11.5, color: AC2, textDecoration: "none" }}>View client profile →</Link>
            )}
          </div>

          {/* Invoice details */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Issue date", val: formatDate(invoice.issue_date) },
                ...(invoice.due_date ? [{ label: "Due date", val: formatDate(invoice.due_date) }] : []),
                { label: "Payment method", val: invoice.payment_mode.replace("_", " ") },
                { label: "Currency", val: invoice.currency },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: T3 }}>{label}</span>
                  <span style={{ color: T1, fontWeight: 500, textTransform: "capitalize" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {invoice.payment_status !== "complete" && (
                <button onClick={() => setShowPayment(true)} style={{ ...ICON_PILL, width: "100%", borderRadius: 8, height: 34, fontSize: 12, color: "#34d399", background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.25)", justifyContent: "center", gap: 6 }}>
                  + Record payment
                </button>
              )}
              <Link href={`/invoices/${id}/edit`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", height: 34, borderRadius: 8, fontSize: 12, color: T2, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, textDecoration: "none" }}>
                Edit invoice
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>{invoice.invoice_no} · Outstanding: {formatCurrency(invoice.outstanding, invoice.currency)}</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Amount */}
            <div>
              <label style={lbl}>Amount received *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T3, fontWeight: 500 }}>{invoice.currency}</span>
                <input type="number" step="0.01" min="0.01" max={invoice.outstanding} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={{ ...FIELD_INPUT, paddingLeft: 44, fontSize: 16, fontWeight: 600 }} placeholder="0.00" />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {[[String(invoice.outstanding / 2), `Half (${formatCurrency(invoice.outstanding / 2, invoice.currency)})`], [String(invoice.outstanding), `Full (${formatCurrency(invoice.outstanding, invoice.currency)})`]].map(([val, lbl]) => (
                  <button key={val} onClick={() => setForm(p => ({ ...p, amount: val }))} style={{ fontSize: 11, color: AC2, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={FIELD_INPUT} /></div>
              <div>
                <label style={lbl}>Method *</label>
                <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value as PaymentMethod }))} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div><label style={lbl}>Reference / transaction number</label><input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Bank ref, cheque #..." style={FIELD_INPUT} /></div>
            <div><label style={lbl}>Note</label><input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="e.g. Final payment for office renovation" style={FIELD_INPUT} /></div>

            {/* Live preview */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "0.5px solid rgba(99,102,241,0.2)", display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T3, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>After this payment</div>
              {[
                { l: "Invoice total", v: formatCurrency(invoice.total_amount, invoice.currency), c: T2 },
                { l: "Previously collected", v: formatCurrency(invoice.total_paid, invoice.currency), c: "#34d399" },
                { l: "This payment", v: form.amount ? formatCurrency(parseFloat(form.amount), invoice.currency) : "—", c: "#34d399" },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: T3 }}>{l}</span><span style={{ color: c, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, borderTop: `0.5px solid rgba(99,102,241,0.2)`, paddingTop: 6, marginTop: 2 }}>
                <span style={{ color: T2 }}>Remaining</span>
                <span style={{ color: afterThis === 0 ? "#34d399" : "#fbbf24" }}>{afterThis === 0 ? "✓ Paid in full" : formatCurrency(afterThis, invoice.currency)}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button loading={saving} onClick={recordPayment} style={{ background: "linear-gradient(135deg,#059669,#34d399)", boxShadow: "0 2px 12px rgba(52,211,153,0.3)" }}>
              ✓ Record payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Receipt Preview Modal */}
      {receiptPayment && invoice && (
        <Dialog open={!!receiptPayment} onOpenChange={() => setReceiptPayment(null)}>
          <DialogContent style={{ maxWidth: 660, padding: 0, overflow: "hidden" }}>
            <DialogHeader style={{ padding: "14px 18px 10px", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
              <DialogTitle>Payment Receipt</DialogTitle>
              <DialogDescription>{invoice.invoice_no} · {formatDate(receiptPayment.date)}</DialogDescription>
            </DialogHeader>
            <div style={{ padding: "16px 18px", overflowY: "auto", maxHeight: "70vh" }}>
              <ReceiptPreview
                invoice={invoice}
                payment={receiptPayment}
                settings={settings}
              />
            </div>
            <div style={{ padding: "12px 18px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={() => setReceiptPayment(null)}>Close</Button>
              <Button onClick={() => {
                const printWin = window.open("", "_blank", "width=700,height=900");
                if (!printWin) return;
                const receiptEl = document.getElementById("receipt-print-area");
                printWin.document.write(`<html><head><title>Receipt</title><style>@media print{body{margin:0}}</style></head><body>${receiptEl?.innerHTML ?? ""}</body></html>`);
                printWin.document.close();
                printWin.focus();
                setTimeout(() => { printWin.print(); printWin.close(); }, 300);
              }}>
                Print / Save PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Receipt preview component ────────────────────────────────────────────────
function ReceiptPreview({ invoice, payment, settings }: { invoice: Invoice; payment: PaymentEntry; settings: any }) {
  const userDesigns = settings?.documentDesigns ?? [];
  const receiptDesignId = settings?.lastUsed?.receiptDesignId;
  const receiptDesign = receiptDesignId
    ? getDesignById(receiptDesignId, userDesigns)
    : getDefaultDesign("receipt", userDesigns);

  // Calculate remaining balance after this payment
  const paidBefore = invoice.payments
    .filter(p => p._id !== payment._id)
    .reduce((s, p) => s + p.amount, 0) + invoice.advance;
  const remainingAfter = Math.max(0, invoice.total_amount - paidBefore - payment.amount);

  return (
    <div id="receipt-print-area">
      <DocumentRenderer
        design={receiptDesign}
        width={595}
        data={{
          type: "receipt",
          docNo: `RCP-${invoice.invoice_no}`,
          issueDate: payment.date,
          customer: {
            name: invoice.customer_name,
            phone: invoice.customer_phone,
            address: invoice.customer_address,
          },
          invoiceNo: invoice.invoice_no,
          paymentDate: payment.date,
          paymentAmount: payment.amount,
          paymentMethod: payment.method,
          paymentRef: payment.reference,
          remainingBalance: remainingAfter,
          total: invoice.total_amount,
          currency: invoice.currency,
          companyName: settings?.company_name ?? "Your Company",
          companyEmail: settings?.company_email,
          companyPhone: settings?.company_phone,
          companyAddress: settings?.company_address,
          termsText: settings?.terms_and_conditions,
        }}
      />
    </div>
  );
}
