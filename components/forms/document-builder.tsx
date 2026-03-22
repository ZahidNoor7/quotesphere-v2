"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, FIELD_INPUT } from "@/lib/ds";
import type { Customer, Service } from "@/types";
import { useSettings } from "@/hooks/use-settings";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import { BUILT_IN_DESIGNS, getAllDesigns, getDesignById, getDefaultDesign } from "@/lib/document-designs";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

interface LineItem { id: number; name: string; quantity: number; price: number; }
interface BuilderProps { type: "invoice" | "quotation"; initialData?: any; }

export function DocumentBuilder({ type, initialData }: BuilderProps) {
  const router = useRouter();
  const { settings, updateLastUsed } = useSettings();
  const { data: customers = [] } = useSWR<Customer[]>("/api/customers?limit=200", fetcher);
  const { data: services = [] } = useSWR<Service[]>("/api/services", fetcher);
  const [showPreview, setShowPreview] = useState(true);
  const [showDesignPicker, setShowDesignPicker] = useState(false);
  const designPickerRef = useRef<HTMLDivElement>(null);

  const [customerId, setCustomerId] = useState(initialData?.customer_id ?? "");
  const [issueDate, setIssueDate] = useState(initialData?.issue_date ? new Date(initialData.issue_date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));
  const [dueDate, setDueDate] = useState(initialData?.due_date ? new Date(initialData.due_date).toISOString().slice(0,10) : "");
  const [currency, setCurrency] = useState(initialData?.currency ?? "PKR");
  const [paymentMode, setPaymentMode] = useState(initialData?.payment_mode ?? "cash");
  const [designId, setDesignId] = useState<string>(initialData?.designId ?? "");

  // Apply lastUsed defaults once settings load (new documents only)
  const appliedLastUsed = useRef(false);
  useEffect(() => {
    if (!initialData && settings?.lastUsed && !appliedLastUsed.current) {
      appliedLastUsed.current = true;
      if (settings.lastUsed.currency) setCurrency(settings.lastUsed.currency);
      if (settings.lastUsed.paymentMethod) setPaymentMode(settings.lastUsed.paymentMethod);
      const lastDesignId = type === "invoice"
        ? settings.lastUsed.invoiceDesignId
        : settings.lastUsed.quotationDesignId;
      if (lastDesignId) setDesignId(lastDesignId);
    }
  }, [settings, initialData, type]);

  const [advance, setAdvance] = useState(initialData?.advance?.toString() ?? "0");
  const [tax, setTax] = useState(initialData?.tax?.toString() ?? "0");
  const [taxType, setTaxType] = useState<"percentage" | "value">(initialData?.tax_type ?? "percentage");
  const [discount, setDiscount] = useState(initialData?.discount?.toString() ?? "0");
  const [delivery, setDelivery] = useState(initialData?.delivery_charges?.toString() ?? "0");
  const [remarks, setRemarks] = useState(initialData?.remarks ?? "");
  const [items, setItems] = useState<LineItem[]>(initialData?.items ?? [{ id: 1, name: "", quantity: 1, price: 0 }]);
  const [loading, setLoading] = useState(false);

  const customer = (customers as Customer[]).find(c => c._id === customerId);
  const subTotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const taxAmt = taxType === "percentage" ? (subTotal * parseFloat(tax || "0")) / 100 : parseFloat(tax || "0");
  const total = subTotal + taxAmt + parseFloat(delivery || "0") - parseFloat(discount || "0");
  const outstanding = Math.max(0, total - parseFloat(advance || "0"));

  // Resolve the active design
  const userDesigns = settings?.documentDesigns ?? [];
  const docType = type === "invoice" ? "invoice" as const : "quotation" as const;
  const allDesigns = getAllDesigns(userDesigns, docType);
  const activeDesign = designId
    ? getDesignById(designId, userDesigns)
    : getDefaultDesign(docType, userDesigns);

  // Close design picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (designPickerRef.current && !designPickerRef.current.contains(e.target as Node)) {
        setShowDesignPicker(false);
      }
    }
    if (showDesignPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDesignPicker]);

  function addItem() { setItems(p => [...p, { id: Date.now(), name: "", quantity: 1, price: 0 }]); }
  function removeItem(id: number) { if (items.length > 1) setItems(p => p.filter(i => i.id !== id)); }
  function updateItem(id: number, key: keyof LineItem, val: string | number) {
    setItems(p => p.map(i => i.id === id ? { ...i, [key]: key === "name" ? val : (parseFloat(val as string) || 0) } : i));
  }

  function selectDesign(id: string) {
    setDesignId(id);
    setShowDesignPicker(false);
    const lastUsedUpdates = type === "invoice" ? { invoiceDesignId: id } : { quotationDesignId: id };
    updateLastUsed(lastUsedUpdates);
  }

  async function handleSubmit(status: string) {
    if (!customerId) { toast.error("Please select a client."); return; }
    if (items.some(i => !i.name)) { toast.error("All line items need a description."); return; }
    setLoading(true);
    const payload: any = {
      issue_date: new Date(issueDate), currency, items, sub_total: subTotal,
      tax: parseFloat(tax || "0"), tax_type: taxType, discount: parseFloat(discount || "0"),
      delivery_charges: parseFloat(delivery || "0"), total_amount: total, remarks,
      customer_id: customerId, customer_name: customer?.name ?? "",
      customer_phone: customer?.phone_no ?? "", customer_address: customer?.address ?? "",
      designId: activeDesign?.id ?? "",
    };
    if (type === "invoice") {
      payload.payment_mode = paymentMode; payload.advance = parseFloat(advance || "0");
      payload.outstanding = outstanding; payload.total_paid = parseFloat(advance || "0");
      payload.status = status; if (dueDate) payload.due_date = new Date(dueDate);
    } else {
      payload.status = status; if (dueDate) payload.valid_until = new Date(dueDate);
    }
    try {
      const url = initialData?._id
        ? `/api/${type === "invoice" ? "invoices" : "quotations"}/${initialData._id}`
        : `/api/${type === "invoice" ? "invoices" : "quotations"}`;
      const res = await fetch(url, { method: initialData?._id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`${type === "invoice" ? "Invoice" : "Quotation"} ${initialData?._id ? "updated" : "created"} successfully.`);
      updateLastUsed({ currency, paymentMethod: paymentMode });
      router.push(type === "invoice" ? `/invoices/${data.data._id}` : `/quotations/${data.data._id}`);
    } catch (err: any) { toast.error(err.message || "Failed to save."); }
    finally { setLoading(false); }
  }

  const typeLabel = type === "invoice" ? "Invoice" : "Quotation";
  const typeColor = type === "invoice" ? "#34d399" : "#818cf8";
  const lbl = { fontSize: 10.5, color: T3, fontWeight: 500, marginBottom: 3 } as const;
  const secTitle = { fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T3, marginBottom: 10, paddingBottom: 6, borderBottom: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", gap: 7 };

  const PICKER_PREVIEWS: Record<string, { bg: string; text: string }> = {
    "classic-corporate": { bg: "#1a2744", text: "#fff" },
    "modern-gradient":   { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", text: "#fff" },
    "minimal-clean":     { bg: "#f8f9fa", text: "#374151" },
    "executive-dark":    { bg: "#0f172a", text: "#94a3b8" },
    "bold-accent":       { bg: "#fff7ed", text: "#f97316" },
    "retro-serif":       { bg: "#faf7f0", text: "#8b4513" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={{ ...TOPBAR_STYLE, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link href={type === "invoice" ? "/invoices" : "/quotations"}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, cursor: "pointer", textDecoration: "none", transition: "all 0.15s" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4"/></svg>
            {type === "invoice" ? "Invoices" : "Quotations"}
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{initialData?._id ? `Edit ${typeLabel}` : `New ${typeLabel}`}</div>
          <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", background: type === "invoice" ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.15)", color: typeColor, border: `0.5px solid ${type === "invoice" ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.3)"}` }}>
            {typeLabel.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
          {/* ── Design picker ── */}
          <div style={{ position: "relative" }} ref={designPickerRef}>
            <button
              onClick={() => setShowDesignPicker(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 100,
                background: showDesignPicker ? "rgba(99,102,241,0.15)" : GLASS,
                border: `0.5px solid ${showDesignPicker ? "rgba(99,102,241,0.4)" : GLASS_BORDER}`,
                color: T2, fontSize: 11, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
              Design: {activeDesign?.name ?? "Modern Gradient"}
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6 }}><path d="M2 3.5L5 6.5l3-3"/></svg>
            </button>
            {showDesignPicker && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
                background: "rgba(12,16,32,0.97)", border: `0.5px solid ${GLASS_BORDER}`,
                borderRadius: 10, backdropFilter: "blur(24px)", padding: 8,
                width: 284, boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}>
                <div style={{ fontSize: 9.5, color: T3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 6px 8px" }}>Select Design</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {allDesigns.map(d => {
                    const preset = d.config.preset ?? "modern-gradient";
                    const meta = PICKER_PREVIEWS[preset] ?? PICKER_PREVIEWS["modern-gradient"];
                    const isActive = activeDesign?.id === d.id;
                    return (
                      <button key={d.id} onClick={() => selectDesign(d.id)}
                        style={{
                          border: `1px solid ${isActive ? "#818cf8" : GLASS_BORDER}`,
                          borderRadius: 6, overflow: "hidden", cursor: "pointer",
                          background: isActive ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
                          transition: "all 0.15s", padding: 0, textAlign: "left",
                        }}
                      >
                        <div style={{ height: 32, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 7px" }}>
                          <span style={{ fontSize: 7, fontWeight: 700, color: meta.text }}>Co.</span>
                          <span style={{ fontSize: 8, fontWeight: 800, color: meta.text }}>INV</span>
                        </div>
                        <div style={{ padding: "4px 7px 5px" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 500, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                          {isActive && <div style={{ fontSize: 8, color: AC2 }}>Active</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Link href="/settings/document-design" style={{ display: "block", textAlign: "center", fontSize: 10, color: T3, marginTop: 8, padding: "5px 0", borderTop: `0.5px solid ${GLASS_BORDER}`, textDecoration: "none" }}>
                  Manage designs →
                </Link>
              </div>
            )}
          </div>

          <button onClick={() => setShowPreview(v => !v)}
            style={{ width: 30, height: 30, borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center", background: showPreview ? "rgba(99,102,241,0.2)" : GLASS, border: `0.5px solid ${showPreview ? "rgba(99,102,241,0.4)" : GLASS_BORDER}`, color: showPreview ? AC2 : T2, cursor: "pointer", transition: "all 0.15s" }}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M1.5 8C3 4 5 2 8 2s5 2 6.5 6c-1.5 4-3.5 6-6.5 6s-5-2-6.5-6z"/></svg>
          </button>
          {type === "invoice" ? (
            initialData?._id && initialData?.status !== "draft" ? (
              <Button loading={loading} onClick={() => handleSubmit(initialData.status)}>Update Invoice</Button>
            ) : (
              <>
                <Button variant="secondary" loading={loading} onClick={() => handleSubmit("draft")}>Save as Draft</Button>
                <Button loading={loading} onClick={() => handleSubmit("issued")}>Issue Invoice</Button>
              </>
            )
          ) : (
            <Button loading={loading} onClick={() => handleSubmit("pending")}>
              {initialData?._id ? "Update Quotation" : "Save Quotation"}
            </Button>
          )}
        </div>
      </div>

      {/* Builder body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: form */}
        <div style={{ width: showPreview ? 380 : "100%", flexShrink: 0, borderRight: showPreview ? `0.5px solid ${GLASS_BORDER}` : "none", overflowY: "auto", background: "rgba(10,14,28,0.6)", transition: "width 0.3s ease" }}>

          {/* Client & dates */}
          <div style={{ padding: "14px 16px 0" }}>
            <div style={secTitle}>Client & details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={lbl}>Client *</div>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                  <option value="">Select a client</option>
                  {(customers as Customer[]).map(c => <option key={c._id} value={c._id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><div style={lbl}>{type === "invoice" ? "Issue date" : "Date"}</div><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={FIELD_INPUT} /></div>
                <div><div style={lbl}>{type === "invoice" ? "Due date" : "Valid until"}</div><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={FIELD_INPUT} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={lbl}>Currency</div>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                    {(settings?.enabledCurrencies?.length ? settings.enabledCurrencies : ["PKR","USD","EUR","GBP","AED","SAR"]).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {type === "invoice" && (
                  <div>
                    <div style={lbl}>Payment method</div>
                    <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
                      {[["cash","Cash"],["bank_transfer","Bank transfer"],["card","Card / POS"],["online","Online"],["cheque","Cheque"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Services quick-add */}
          {(services as Service[]).length > 0 && (
            <div style={{ padding: "10px 16px 0" }}>
              <div style={secTitle}>Quick-add from catalog</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 4 }}>
                {(services as Service[]).slice(0, 12).map(s => (
                  <button key={s._id}
                    onClick={() => setItems(p => [...p, { id: Date.now(), name: s.name, quantity: 1, price: s.default_price }])}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 11px", background: "rgba(99,102,241,0.11)", border: "0.5px solid rgba(99,102,241,0.22)", color: AC2, borderRadius: 100, fontSize: 11, cursor: "pointer", transition: "all 0.15s", margin: 2 }}
                    onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(99,102,241,0.22)", transform: "scale(1.02)" })}
                    onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(99,102,241,0.11)", transform: "none" })}
                  >+ {s.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          <div style={{ padding: "10px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ ...secTitle, marginBottom: 0 }}>Line items</div>
              <button onClick={addItem} style={{ fontSize: 11, color: AC2, background: "rgba(99,102,241,0.11)", border: `0.5px solid rgba(99,102,241,0.22)`, padding: "3px 10px", borderRadius: 100, cursor: "pointer" }}>+ Add row</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 52px 85px 75px 26px", gap: 5, padding: "6px 10px", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", color: T3, background: "rgba(255,255,255,0.025)", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
              <span>Description</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Total</span><span />
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 52px 85px 75px 26px", gap: 5, padding: "6px 10px", borderBottom: `0.5px solid rgba(255,255,255,0.04)`, alignItems: "center" }}>
                <input value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="Service or item" style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 7px", color: T1, fontSize: 11, width: "100%", outline: "none" }} />
                <input type="number" min="0" value={item.quantity} onChange={e => updateItem(item.id, "quantity", e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 5px", color: T1, fontSize: 11, width: "100%", outline: "none", textAlign: "center" }} />
                <input type="number" min="0" value={item.price} onChange={e => updateItem(item.id, "price", e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "4px 7px", color: T1, fontSize: 11, width: "100%", outline: "none", textAlign: "right" }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: T1, textAlign: "right" }}>{formatCurrency(item.quantity * item.price, currency)}</span>
                <button onClick={() => removeItem(item.id)} disabled={items.length === 1} style={{ width: 22, height: 22, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: items.length === 1 ? "rgba(255,255,255,0.15)" : T3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                </button>
              </div>
            ))}
            {/* Totals */}
            <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${GLASS_BORDER}`, background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { label: "Subtotal", val: formatCurrency(subTotal, currency), color: T2 },
                ...(parseFloat(tax) > 0 ? [{ label: `Tax (${tax}${taxType === "percentage" ? "%" : " fixed"})`, val: formatCurrency(taxAmt, currency), color: T2 }] : []),
                ...(parseFloat(discount) > 0 ? [{ label: "Discount", val: `-${formatCurrency(parseFloat(discount), currency)}`, color: "#34d399" }] : []),
                ...(parseFloat(delivery) > 0 ? [{ label: "Delivery", val: formatCurrency(parseFloat(delivery), currency), color: T2 }] : []),
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                  <span>{label}</span><span style={{ color }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, marginTop: 6, paddingTop: 8 }}>
                <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(total, currency)}</span>
              </div>
              {type === "invoice" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={lbl}>Advance received</div>
                    <input type="number" min="0" value={advance} onChange={e => setAdvance(e.target.value)} style={{ ...FIELD_INPUT, fontSize: 12 }} />
                  </div>
                  <div style={{ textAlign: "right", paddingTop: 18 }}>
                    <div style={{ fontSize: 11, color: T3 }}>Outstanding</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: outstanding === 0 ? "#34d399" : "#fbbf24" }}>{formatCurrency(outstanding, currency)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div style={{ padding: "10px 16px 14px" }}>
            <div style={secTitle}>Remarks / notes</div>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Any additional notes..." style={{ ...FIELD_INPUT, resize: "none", height: 68, fontSize: 11 }} />
          </div>
        </div>

        {/* Right: live document preview */}
        {showPreview && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(8,11,22,0.5)" }}>
            <div style={{ padding: "10px 16px", borderBottom: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(13,17,32,0.5)", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: T3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live preview</span>
              <span style={{ fontSize: 11, color: T3 }}>{activeDesign?.name ?? "Modern Gradient"}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", justifyContent: "center" }}>
              <LivePreview
                design={activeDesign}
                type={type}
                items={items}
                customer={customer}
                issueDate={issueDate}
                dueDate={dueDate}
                currency={currency}
                subTotal={subTotal}
                taxAmt={taxAmt}
                taxLabel={`Tax (${tax}${taxType === "percentage" ? "%" : " fixed"})`}
                discount={parseFloat(discount || "0")}
                delivery={parseFloat(delivery || "0")}
                total={total}
                advance={parseFloat(advance || "0")}
                outstanding={outstanding}
                remarks={remarks}
                settings={settings}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Live preview with auto-sizing ───────────────────────────────────────────
function LivePreview({ design, type, items, customer, issueDate, dueDate, currency, subTotal, taxAmt, taxLabel, discount, delivery, total, advance, outstanding, remarks, settings }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(380);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setPreviewWidth(Math.min(e.contentRect.width - 36, 540));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const activeDesign = design ?? BUILT_IN_DESIGNS.find(d => d.id === "modern-gradient")!;

  return (
    <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)", borderRadius: 4, overflow: "hidden" }}>
        <DocumentRenderer
          design={activeDesign}
          width={previewWidth}
          data={{
            type,
            docNo: "Auto-generated",
            issueDate,
            dueDate: dueDate || undefined,
            customer: customer ? { name: customer.name, phone: customer.phone_no, address: customer.address } : undefined,
            items: items.filter((i: any) => i.name),
            subTotal,
            taxAmt,
            taxLabel,
            discount,
            delivery,
            total,
            advance,
            outstanding,
            currency,
            remarks,
            companyName: settings?.company_name ?? "Your Company",
            companyEmail: settings?.company_email,
            companyPhone: settings?.company_phone,
            companyAddress: settings?.company_address,
            termsText: settings?.terms_and_conditions,
          }}
        />
      </div>
    </div>
  );
}
