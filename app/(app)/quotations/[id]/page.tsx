"use client";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Download, MessageCircle, Mail, Copy, MoreHorizontal, LayoutTemplate, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker";
import { QuotationStatusBadge } from "@/components/shared/status-badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import { downloadServerPdf, fetchServerPdfBlob } from "@/lib/pdf/client";
import { buildDocumentData } from "@/lib/doc-data";
import { T1, T2, T3, AC, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD, ICON_PILL } from "@/lib/ds";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import { getDesignById, getDefaultDesign } from "@/lib/document-designs";
import { useSettings } from "@/hooks/use-settings";
import type { Quotation, Customer } from "@/types";
import { WhatsAppSendModal, buildQuotationMessage } from "@/components/shared/whatsapp-send-modal";
import { EmailSendModal, buildQuotationEmailBody } from "@/components/shared/email-send-modal";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: quotation, mutate, isLoading } = useSWR<Quotation>(`/api/quotations/${id}`, fetcher);
  const { data: customerData } = useSWR<{ customer?: Customer }>(quotation?.customer_id ? `/api/customers/${quotation.customer_id}` : null, fetcher);
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const [showConvert, setShowConvert] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [sharing, setSharing] = useState<"whatsapp" | "email" | "download" | null>(null);
  const [showWAModal, setShowWAModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const waConfigured = !!(settings?.integrations?.whatsapp?.enabled && settings?.integrations?.whatsapp?.apiKey);
  const emailConfigured = !!settings?.emailConfigured;
  const [converting, setConverting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [convForm, setConvForm] = useState({ issue_date: new Date().toISOString().slice(0, 10), due_date: "", payment_mode: "cash" });

  const userDesigns = settings?.documentDesigns ?? [];
  const quotationDesignId = quotation?.designId ?? settings?.lastUsed?.quotationDesignId;
  const quotationDesign = quotationDesignId
    ? getDesignById(quotationDesignId, userDesigns)
    : getDefaultDesign("quotation", userDesigns);

  if (isLoading) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes shimmer { from { background-position: -600px 0 } to { background-position: 600px 0 } }
        .sk { border-radius: 5px; background: linear-gradient(90deg, var(--glass) 25%, var(--glass-hover) 50%, var(--glass) 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite linear; }
      `}</style>
      {/* Topbar skeleton */}
      <div style={{ ...TOPBAR_STYLE }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div className="sk" style={{ width: 90, height: 26, borderRadius: 100 }} />
          <div className="sk" style={{ width: 100, height: 18 }} />
          <div className="sk" style={{ width: 64, height: 20, borderRadius: 100 }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div className="sk" style={{ width: 64, height: 30, borderRadius: 7 }} />
          <div className="sk" style={{ width: 72, height: 30, borderRadius: 7 }} />
          <div className="sk" style={{ width: 80, height: 30, borderRadius: 7 }} />
        </div>
      </div>
      {/* Body skeleton */}
      <div style={{ flex: 1, overflowY: "auto", display: isMobile ? "flex" : "grid", flexDirection: "column" as const, gridTemplateColumns: isMobile ? undefined : "1fr 280px", alignItems: isMobile ? undefined : "start" }}>
        {/* Left */}
        <div style={{ overflowY: "visible", padding: isMobile ? "14px 12px" : "18px 24px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* Items card */}
          <div style={{ ...CARD }}>
            <div style={{ padding: "12px 16px 10px" }}>
              <div className="sk" style={{ width: 80, height: 14 }} />
            </div>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 60px 90px 90px", gap: 8, padding: "7px 12px", background: "var(--glass)" }}>
              {[140, 40, 50, 50].map((w, i) => <div key={i} className="sk" style={{ width: w, height: 10, justifySelf: i === 0 ? "start" : "end" }} />)}
            </div>
            {/* Rows */}
            {[75, 55, 90, 60].map((w, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 60px 90px 90px", gap: 8, padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", alignItems: "center" }}>
                <div className="sk" style={{ width: w + "%", height: 12 }} />
                <div className="sk" style={{ width: 28, height: 12, justifySelf: "end" }} />
                <div className="sk" style={{ width: 52, height: 12, justifySelf: "end" }} />
                <div className="sk" style={{ width: 60, height: 12, justifySelf: "end" }} />
              </div>
            ))}
            {/* Totals footer */}
            <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 200 }}>
                {[["Subtotal", 70], ["Tax", 50]].map(([, w]) => (
                  <div key={w} style={{ display: "flex", justifyContent: "space-between" }}>
                    <div className="sk" style={{ width: 50, height: 11 }} />
                    <div className="sk" style={{ width: w as number, height: 11 }} />
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 2 }}>
                  <div className="sk" style={{ width: 36, height: 14 }} />
                  <div className="sk" style={{ width: 80, height: 14 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Right panel */}
        <div style={{ display: isMobile ? "none" : "flex", borderLeft: `0.5px solid ${GLASS_BORDER}`, overflowY: "auto", padding: "18px 16px", flexDirection: "column", gap: 12, position: "sticky" as const, top: 0, alignSelf: "start", maxHeight: "calc(100dvh - 58px)" }}>
          {/* Client card */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div className="sk" style={{ width: 44, height: 10, marginBottom: 12 }} />
            <div className="sk" style={{ width: "80%", height: 14, marginBottom: 8 }} />
            <div className="sk" style={{ width: "55%", height: 11 }} />
          </div>
          {/* Details card */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div className="sk" style={{ width: 50, height: 10, marginBottom: 12 }} />
            {[["Issued", 70], ["Valid until", 70], ["Currency", 30]].map(([, w]) => (
              <div key={w} style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <div className="sk" style={{ width: 55, height: 11 }} />
                <div className="sk" style={{ width: w as number, height: 11 }} />
              </div>
            ))}
          </div>
          {/* Actions card */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div className="sk" style={{ width: 52, height: 10, marginBottom: 12 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div className="sk" style={{ width: "100%", height: 34, borderRadius: 8 }} />
              <div className="sk" style={{ width: "100%", height: 34, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
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
      <div style={{ ...TOPBAR_STYLE, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" as const }}>
          <Link href="/quotations" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, textDecoration: "none" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4" /></svg>
            Quotations
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{quotation.quotation_no}</div>
          <QuotationStatusBadge status={quotation.status} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="outline" size="sm" onClick={() => setShowPdfPreview(true)} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <FileText size={13} /> PDF
          </Button>
          {quotation.status === "draft" && (
            <Button asChild size="sm" variant="outline"><Link href={`/quotations/${id}/edit`}>Edit & Send</Link></Button>
          )}
          {quotation.status === "pending" && <>
            <Button variant="outline" size="sm" onClick={reject}>Reject</Button>
            <Button size="sm" onClick={approve} style={{ background: "linear-gradient(135deg,#059669,#34d399)" }}>✓ Approve</Button>
          </>}
          {quotation.status === "approved" && !quotation.converted_to && (
            <Button size="sm" onClick={() => setShowConvert(true)}>{isMobile ? "Convert →" : "Convert to invoice →"}</Button>
          )}
          {quotation.converted_to && (
            <Button asChild variant="outline" size="sm"><Link href={`/invoices/${quotation.converted_to}`}>View invoice →</Link></Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Send size={13} /> Send
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: 200 }}>
              <DropdownMenuItem onClick={() => {
                if (waConfigured) setShowWAModal(true);
                else toast.error("WhatsApp isn't set up.", { description: "Configure it in Settings → Integrations to send directly.", action: { label: "Configure", onClick: () => { window.location.href = "/settings/integrations"; } } });
              }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={13} color="#25D366" /> Send via WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (emailConfigured) setShowEmailModal(true);
                else toast.error("Email isn't set up.", { description: "Configure it in Settings → Integrations to send by email.", action: { label: "Configure", onClick: () => { window.location.href = "/settings/integrations"; } } });
              }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={13} /> Send via Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={sharing === "download"} onClick={async () => {
                setSharing("download");
                try { await downloadServerPdf("quotation", quotation._id, `Quotation-${quotation.quotation_no}.pdf`); }
                catch (err) { toast.error(err instanceof Error ? err.message : "Failed to generate PDF."); }
                finally { setSharing(null); }
              }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Download size={13} /> Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" style={{ width: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ minWidth: 180 }}>
              <DropdownMenuItem asChild>
                <Link href={`/quotations/new?from=${id}`} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <Copy size={13} /> Duplicate quotation
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSaveTemplate(true)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LayoutTemplate size={13} /> Save as template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {quotation.status === "expired" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "rgba(245,158,11,0.1)", borderBottom: "0.5px solid rgba(245,158,11,0.3)", flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#f59e0b" strokeWidth="1.6" style={{ flexShrink: 0 }}>
            <path d="M8 1.5L14.5 13H1.5L8 1.5z" /><path d="M8 6v3.5" strokeLinecap="round" /><circle cx="8" cy="11.5" r="0.6" fill="#f59e0b" stroke="none" />
          </svg>
          <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 500 }}>
            This quotation expired on {formatDate(quotation.valid_until!)} and is no longer valid.
          </span>
          {!quotation.converted_to && (
            <button
              onClick={approve}
              style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 100, background: "rgba(245,158,11,0.15)", border: "0.5px solid rgba(245,158,11,0.4)", color: "#f59e0b", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
            >
              Approve anyway
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: isMobile ? "flex" : "grid", flexDirection: "column" as const, gridTemplateColumns: isMobile ? undefined : "1fr 280px", alignItems: isMobile ? undefined : "start" }}>
        <div style={{ overflowY: "visible", padding: isMobile ? "14px 12px" : "18px 24px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

          {/* Line items */}
          <div style={CARD}>
            <div style={{ padding: "12px 16px 8px", fontSize: 12, fontWeight: 500, color: T1 }}>Line items</div>
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px 12px" }}>
                {quotation.items.map((item, i) => (
                  <div key={i} style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)", borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{item.quantity} × {formatCurrency(item.price, quotation.currency)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T1, flexShrink: 0 }}>{formatCurrency(item.price * item.quantity, quotation.currency)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
                  <thead>
                    <tr style={{ background: "var(--glass)" }}>
                      {["Description", "Qty", "Rate", "Total"].map(h => (
                        <th key={h} style={{ padding: "9px 16px", textAlign: h !== "Description" ? "right" : "left", fontSize: 10, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T1, fontWeight: 500 }}>{item.name}</td>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T2, textAlign: "right" }}>{item.quantity}</td>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T2, textAlign: "right" }}>{formatCurrency(item.price, quotation.currency)}</td>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T1, fontWeight: 600, textAlign: "right" }}>{formatCurrency(item.price * item.quantity, quotation.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
        <div style={{ borderLeft: isMobile ? "none" : `0.5px solid ${GLASS_BORDER}`, borderTop: isMobile ? `0.5px solid ${GLASS_BORDER}` : "none", overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "14px 12px" : "18px 16px", display: "flex", flexDirection: "column", gap: 12, ...(isMobile ? {} : { position: "sticky" as const, top: 0, alignSelf: "start", maxHeight: "calc(100dvh - 58px)" }) }}>
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
          {/* Actions */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={() => setShowPdfPreview(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", height: 34, borderRadius: 8, fontSize: 12, color: T2, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, cursor: "pointer" }}>
                <FileText size={12} /> Preview PDF
              </button>
              <Link href={`/quotations/${id}/edit`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", height: 34, borderRadius: 8, fontSize: 12, color: T2, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, textDecoration: "none" }}>
                Edit quotation
              </Link>
            </div>
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
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => setSelectedItems(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                      />
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
              <div>
                <label style={{ fontSize: 10.5, color: T3, display: "block", marginBottom: 3 }}>Issue date</label>
                <DatePickerInput value={convForm.issue_date} onChange={d => setConvForm(p => ({ ...p, issue_date: d }))} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: T3, display: "block", marginBottom: 3 }}>Due date</label>
                <DatePickerInput value={convForm.due_date} onChange={d => setConvForm(p => ({ ...p, due_date: d }))} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10.5, color: T3, display: "block", marginBottom: 3 }}>Payment method</label>
              <Select value={convForm.payment_mode} onValueChange={v => setConvForm(p => ({ ...p, payment_mode: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[["cash", "Cash"], ["bank_transfer", "Bank transfer"], ["card", "Card / POS"], ["online", "Online"], ["cheque", "Cheque"]].map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, fontSize: 11.5, color: T3, display: "flex", flexDirection: "column", gap: 3 }}>
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
      {/* Quotation PDF Preview Sheet */}
      <Sheet open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "flex flex-col p-0 gap-0 h-[85dvh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[600px] sm:max-w-[600px]"}
        >
          <SheetHeader style={{ padding: "14px 18px 10px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>Quotation Preview</SheetTitle>
            <SheetDescription>{quotation.quotation_no} · {quotation.customer_name}</SheetDescription>
          </SheetHeader>
          <div style={{ flex: 1, padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div id="quotation-print-area">
              <DocumentRenderer
                design={quotationDesign}
                width={isMobile ? 320 : 580}
                data={buildDocumentData("quotation", quotation, settings)}
              />
            </div>
          </div>
          <div style={{ padding: "12px 18px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Button
                variant="outline"
                size="sm"
                style={{ display: "flex", alignItems: "center", gap: 5, color: "#25D366", borderColor: "rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.06)" }}
                onClick={() => {
                  if (waConfigured) setShowWAModal(true);
                  else toast.error("WhatsApp isn't set up.", { description: "Configure it in Settings → Integrations to send directly.", action: { label: "Configure", onClick: () => { window.location.href = "/settings/integrations"; } } });
                }}
              >
                <MessageCircle size={13} /> WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                style={{ display: "flex", alignItems: "center", gap: 5 }}
                onClick={() => {
                  if (emailConfigured) setShowEmailModal(true);
                  else toast.error("Email isn't set up.", { description: "Configure it in Settings → Integrations to send by email.", action: { label: "Configure", onClick: () => { window.location.href = "/settings/integrations"; } } });
                }}
              >
                <Mail size={13} /> Email
              </Button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button
                size="sm"
                disabled={sharing === "download"}
                loading={sharing === "download"}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
                onClick={async () => {
                  setSharing("download");
                  try {
                    await downloadServerPdf("quotation", quotation._id, `Quotation-${quotation.quotation_no}.pdf`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to generate PDF.");
                  } finally { setSharing(null); }
                }}
              >
                <Download size={13} /> Download PDF
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Send modals (page-level so the topbar Send menu works without the preview open) */}
      <WhatsAppSendModal
        open={showWAModal}
        onClose={() => setShowWAModal(false)}
        defaultPhone={quotation.customer_phone?.replace(/\D/g, "") ?? ""}
        defaultMessage={buildQuotationMessage({
          customerName: quotation.customer_name,
          quotationNo: quotation.quotation_no,
          amount: formatCurrency(quotation.total_amount, quotation.currency),
          companyName: settings?.company_name,
        })}
        docFilename={`Quotation-${quotation.quotation_no}.pdf`}
        isSandbox={settings?.integrations?.whatsapp?.mode === "sandbox"}
        cloudinaryConfigured={!!settings?.cloudinaryConfigured}
        getPdfBlob={() => fetchServerPdfBlob("quotation", quotation._id)}
      />
      <EmailSendModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        defaultEmail={customerData?.customer?.email}
        payload={{
          type: "quotation",
          customerName: quotation.customer_name,
          docNo: quotation.quotation_no,
          issueDate: formatDate(quotation.issue_date),
          secondDate: quotation.valid_until ? formatDate(quotation.valid_until) : undefined,
          totalAmount: quotation.total_amount,
          currency: quotation.currency,
          companyName: settings?.company_name || "Your business",
        }}
        defaultMessage={buildQuotationEmailBody({
          customerName: quotation.customer_name,
          quotationNo: quotation.quotation_no,
          amount: formatCurrency(quotation.total_amount, quotation.currency),
          validUntil: quotation.valid_until ? formatDate(quotation.valid_until) : undefined,
          companyName: settings?.company_name,
        })}
        getPdfBlob={() => fetchServerPdfBlob("quotation", quotation._id)}
      />

      {/* Save as template dialog */}
      <SaveTemplateDialog
        open={showSaveTemplate}
        quotation={quotation}
        onClose={() => setShowSaveTemplate(false)}
      />

    </div>
  );
}

// ─── Save as template dialog ──────────────────────────────────────────────────
function SaveTemplateDialog({ open, quotation, onClose }: { open: boolean; quotation: Quotation; onClose: () => void }) {
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState<"invoice" | "quotation" | "both">("both");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(""); setTemplateType("both"); } }, [open]);

  async function save() {
    if (!name.trim()) { toast.error("Give the template a name."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), type: templateType,
          items: quotation.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
          tax: quotation.tax, tax_type: quotation.tax_type, discount: quotation.discount,
          delivery_charges: quotation.delivery_charges, currency: quotation.currency,
          remarks: quotation.remarks ?? "", designId: quotation.designId ?? "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Template "${name}" saved.`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save template.");
    } finally { setSaving(false); }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: 380 }}>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>Saves items, tax, discount, and design. Client info is not stored.</DialogDescription>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
          <div>
            <label style={lbl}>Template name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website proposal" autoFocus />
          </div>
          <div>
            <label style={lbl}>Available for</label>
            <Select value={templateType} onValueChange={v => setTemplateType(v as typeof templateType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Invoices & Quotations</SelectItem>
                <SelectItem value="invoice">Invoices only</SelectItem>
                <SelectItem value="quotation">Quotations only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{saving ? "Saving…" : "Save template"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
