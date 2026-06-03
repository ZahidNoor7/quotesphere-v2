"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Send, X, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { T1, T3, GLASS, GLASS_BORDER } from "@/lib/ds";

interface Props {
  open: boolean;
  onClose: () => void;
  payload: {
    type: "invoice" | "quotation";
    customerName: string;
    docNo: string;
    issueDate: string;
    secondDate?: string;
    totalAmount: number;
    currency: string;
    companyName: string;
  };
  defaultEmail?: string;
  defaultMessage: string;
  getPdfBlob?: () => Promise<Blob>;
  onSent?: () => void;
}

export function EmailSendModal({ open, onClose, payload, defaultEmail, defaultMessage, getPdfBlob, onSent }: Props) {
  const [to, setTo] = useState(defaultEmail ?? "");
  const [message, setMessage] = useState(defaultMessage);
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);

  // Prefill the recipient from the customer's email when it becomes available,
  // without overwriting anything the user has already typed.
  useEffect(() => {
    if (open && defaultEmail && !to) setTo(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmail]);

  if (!open) return null;
  const docLabel = payload.type === "invoice" ? "invoice" : "quotation";

  async function send() {
    if (!to.trim() || !message.trim()) { toast.error("Recipient email and message are required"); return; }
    setSending(true);
    try {
      let pdfBase64: string | undefined;
      if (attachPdf && getPdfBlob) {
        toast.info("Generating PDF…");
        const blob = await getPdfBlob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        pdfBase64 = btoa(binary);
      }
      const base = {
        to: to.trim(),
        customerName: payload.customerName,
        issueDate: payload.issueDate,
        totalAmount: payload.totalAmount,
        currency: payload.currency,
        companyName: payload.companyName,
        message: message.trim(),
        ...(pdfBase64 ? { pdfBase64 } : {}),
      };
      const body = payload.type === "invoice"
        ? { type: "invoice", invoiceNo: payload.docNo, ...(payload.secondDate ? { dueDate: payload.secondDate } : {}), ...base }
        : { type: "quotation", quotationNo: payload.docNo, ...(payload.secondDate ? { validUntil: payload.secondDate } : {}), ...base };

      const res = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Email send failed");
      toast.success(`${docLabel === "invoice" ? "Invoice" : "Quotation"} emailed to ${to.trim()}`);
      onSent?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally { setSending(false); }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 16, overflow: "hidden", backdropFilter: "blur(24px)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mail size={16} color="#818cf8" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1, textTransform: "capitalize" }}>Email {docLabel}</div>
            <div style={{ fontSize: 11, color: T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{payload.docNo} · {payload.companyName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 4, display: "flex" }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>To</label>
            <Input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="customer@email.com" />
          </div>
          <div>
            <label style={lbl}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: T1, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
          </div>

          {getPdfBlob && (
            <div onClick={() => setAttachPdf(v => !v)}
              style={{ padding: "10px 12px", borderRadius: 9, background: attachPdf ? "rgba(99,102,241,0.06)" : GLASS, border: `0.5px solid ${attachPdf ? "rgba(99,102,241,0.3)" : GLASS_BORDER}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: attachPdf ? "#6366f1" : "transparent", border: `1.5px solid ${attachPdf ? "#6366f1" : GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {attachPdf && <div style={{ width: 10, height: 7, borderLeft: "2px solid #fff", borderBottom: "2px solid #fff", transform: "rotate(-45deg) translate(1px, -1px)" }} />}
              </div>
              <Paperclip size={13} color={attachPdf ? "#818cf8" : T3} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: attachPdf ? "#818cf8" : T1 }}>Attach PDF</div>
                <div style={{ fontSize: 11, color: T3 }}>{payload.type === "invoice" ? "Invoice" : "Quotation"}-{payload.docNo}.pdf</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button size="sm" disabled={sending || !to.trim() || !message.trim()} onClick={send}>
              <Send size={12} className="mr-1.5" />
              {sending ? (attachPdf ? "Attaching PDF…" : "Sending…") : "Send email"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function buildInvoiceEmailBody(opts: { customerName: string; invoiceNo: string; amount: string; dueDate?: string; companyName?: string }) {
  return `Hi ${opts.customerName},\n\nPlease find attached invoice ${opts.invoiceNo} for ${opts.amount}${opts.dueDate ? `, due ${opts.dueDate}` : ""}.\n\nLet us know if you have any questions.\n\nThank you,\n${opts.companyName ?? ""}`.trim();
}

export function buildQuotationEmailBody(opts: { customerName: string; quotationNo: string; amount: string; validUntil?: string; companyName?: string }) {
  return `Hi ${opts.customerName},\n\nPlease find attached quotation ${opts.quotationNo} for ${opts.amount}${opts.validUntil ? `, valid until ${opts.validUntil}` : ""}.\n\nWe'd be glad to answer any questions.\n\nThank you,\n${opts.companyName ?? ""}`.trim();
}
