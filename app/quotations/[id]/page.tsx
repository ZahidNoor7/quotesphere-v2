"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuotationStatusBadge } from "@/components/shared/status-badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, FIELD_INPUT, CARD } from "@/lib/ds";
import type { Quotation } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: quotation, mutate, isLoading } = useSWR<Quotation>(`/api/quotations/${id}`, fetcher);
  const [showConvert, setShowConvert] = useState(false);
  const [converting, setConverting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [convForm, setConvForm] = useState({ issue_date: new Date().toISOString().slice(0,10), due_date: "", payment_mode: "cash" });

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!quotation) return <div style={{ padding: 24, color: T3 }}>Quotation not found.</div>;

  const displayItems = selectedItems.length === 0 ? quotation.items : quotation.items.filter(i => selectedItems.includes(i.id));
  const convertTotal = displayItems.reduce((s, i) => s + i.price * i.quantity, 0);

  async function approve() {
    await fetch(`/api/quotations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved", approved_at: new Date() }) });
    toast.success("Approved."); mutate();
  }
  async function reject() {
    await fetch(`/api/quotations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected" }) });
    toast.success("Rejected."); mutate();
  }
  async function convertToInvoice() {
    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedItemIds: selectedItems.length > 0 ? selectedItems : undefined, ...convForm }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Invoice ${data.data.invoice.invoice_no} created!`);
      setShowConvert(false); mutate();
      router.push(`/invoices/${data.data.invoice._id}`);
    } catch (err: any) { toast.error(err.message || "Conversion failed."); }
    finally { setConverting(false); }
  }

  const lbl = { fontSize: 10.5, color: T3, fontWeight: 500, marginBottom: 3, display: "block" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Link href="/quotations" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, textDecoration: "none" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4"/></svg>
            Quotations
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{quotation.quotation_no}</div>
          <QuotationStatusBadge status={quotation.status} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {quotation.status === "pending" && <>
            <Button variant="outline" size="sm" onClick={reject}>Reject</Button>
            <Button size="sm" onClick={approve} style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}>✓ Approve</Button>
          </>}
          {quotation.status === "approved" && !quotation.converted_to && (
            <Button size="sm" onClick={() => setShowConvert(true)}>Convert to invoice →</Button>
          )}
          {quotation.converted_to && (
            <Button asChild variant="outline" size="sm"><Link href={`/invoices/${quotation.converted_to}`}>View invoice →</Link></Button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 280px" }}>
        <div style={{ overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Line items */}
          <div style={CARD}>
            <div style={{ padding: "12px 16px 8px", fontSize: 12, fontWeight: 500, color: T1 }}>Line items</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Description","Qty","Rate","Total"].map(h => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: h !== "Description" ? "right" : "left", fontSize: 10, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2, textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2, textAlign: "right" }}>{formatCurrency(item.price, quotation.currency)}</td>
                    <td style={{ padding: "9px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 600, textAlign: "right" }}>{formatCurrency(item.price * item.quantity, quotation.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "10px 16px 12px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}><span>Subtotal</span><span>{formatCurrency(quotation.sub_total, quotation.currency)}</span></div>
                {quotation.tax > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}><span>Tax</span><span>{formatCurrency(quotation.tax_type === "percentage" ? quotation.sub_total * quotation.tax / 100 : quotation.tax, quotation.currency)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(quotation.total_amount, quotation.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {quotation.remarks && (
            <div style={{ ...CARD, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T3, marginBottom: 6 }}>REMARKS</div>
              <div style={{ fontSize: 13, color: T2, lineHeight: 1.6 }}>{quotation.remarks}</div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ borderLeft: `0.5px solid ${GLASS_BORDER}`, overflowY: "auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>Client</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{quotation.customer_name}</div>
            {quotation.customer_phone && <div style={{ fontSize: 12, color: T2, marginTop: 4 }}>{quotation.customer_phone}</div>}
          </div>
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>Details</div>
            {[
              { label: "Issued", val: formatDate(quotation.issue_date) },
              ...(quotation.valid_until ? [{ label: "Valid until", val: formatDate(quotation.valid_until) }] : []),
              { label: "Currency", val: quotation.currency },
              ...(quotation.approved_at ? [{ label: "Approved", val: formatDate(quotation.approved_at) }] : []),
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 7 }}>
                <span style={{ color: T3 }}>{label}</span><span style={{ color: T1, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Convert Modal */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to invoice</DialogTitle>
            <DialogDescription>Select items to include and configure invoice details</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Select items</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {quotation.items.map(item => {
                  const checked = selectedItems.length === 0 || selectedItems.includes(item.id);
                  return (
                    <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${checked ? "rgba(99,102,241,0.35)" : GLASS_BORDER}`, background: checked ? "rgba(99,102,241,0.08)" : GLASS, cursor: "pointer", transition: "all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedItems(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])} style={{ accentColor: "#6366f1" }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T1 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: T2 }}>× {item.quantity}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T1 }}>{formatCurrency(item.price * item.quantity, quotation.currency)}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 10, marginTop: 8 }}>
                <span>Invoice total</span><span style={{ color: AC2 }}>{formatCurrency(convertTotal, quotation.currency)}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={{ fontSize: 10.5, color: T3, display: "block", marginBottom: 3 }}>Issue date</label><input type="date" value={convForm.issue_date} onChange={e => setConvForm(p => ({ ...p, issue_date: e.target.value }))} style={FIELD_INPUT} /></div>
              <div><label style={{ fontSize: 10.5, color: T3, display: "block", marginBottom: 3 }}>Due date</label><input type="date" value={convForm.due_date} onChange={e => setConvForm(p => ({ ...p, due_date: e.target.value }))} style={FIELD_INPUT} /></div>
            </div>
            <div>
              <label style={{ fontSize: 10.5, color: T3, display: "block", marginBottom: 3 }}>Payment method</label>
              <select value={convForm.payment_mode} onChange={e => setConvForm(p => ({ ...p, payment_mode: e.target.value }))} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                {[["cash","Cash"],["bank_transfer","Bank transfer"],["card","Card / POS"],["online","Online"],["cheque","Cheque"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: `0.5px solid ${GLASS_BORDER}`, fontSize: 11.5, color: T3, display: "flex", flexDirection: "column", gap: 3 }}>
              <div>✓ Client info and all line items will be carried over</div>
              <div>✓ Quotation will be marked as <strong style={{ color: AC2 }}>Invoiced</strong></div>
              <div>✓ Bidirectional link stored between both documents</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Button variant="outline" onClick={() => setShowConvert(false)}>Cancel</Button>
            <Button loading={converting} onClick={convertToInvoice}>Create invoice</Button>
          </div>
        </DialogContent>
      </Dialog>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
