"use client";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, X, Paperclip, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPhone: string;
  defaultMessage: string;
  /** If provided, enables "Attach PDF" checkbox */
  getPdfBlob?: () => Promise<Blob>;
  docFilename?: string;
  /** True when WhatsApp is in sandbox mode (PDF not supported) */
  isSandbox?: boolean;
  onSent?: () => void;
}

export function WhatsAppSendModal({
  open, onClose, defaultPhone, defaultMessage,
  getPdfBlob, docFilename, isSandbox, onSent,
}: Props) {
  const [phone, setPhone] = useState(defaultPhone.replace(/\D/g, ""));
  const [message, setMessage] = useState(defaultMessage);
  const [attachPdf, setAttachPdf] = useState(false);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const canAttachPdf = !!getPdfBlob && !isSandbox;

  async function send() {
    if (!phone.trim() || !message.trim()) {
      toast.error("Phone number and message are required");
      return;
    }
    setSending(true);
    try {
      let pdfBase64: string | undefined;

      if (attachPdf && getPdfBlob) {
        toast.info("Generating PDF…");
        const blob = await getPdfBlob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        pdfBase64 = btoa(binary);
      }

      const endpoint = pdfBase64 ? "/api/whatsapp/send-document" : "/api/whatsapp/messages";
      const body = pdfBase64
        ? { phone: phone.trim(), message: message.trim(), pdfBase64, filename: docFilename ?? "document.pdf" }
        : { to: phone.trim(), body: message.trim() };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");

      if (data.data?.pdfSkipped) {
        toast.warning(`Message sent. PDF skipped: ${data.data.pdfSkipped}`);
      } else if (pdfBase64) {
        toast.success("Message and PDF sent via WhatsApp!");
      } else {
        toast.success("Message sent via WhatsApp!");
      }

      onSent?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 500,
        background: GLASS, border: `0.5px solid ${GLASS_BORDER}`,
        borderRadius: 16, overflow: "hidden",
        backdropFilter: "blur(24px)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 18px", borderBottom: `0.5px solid ${GLASS_BORDER}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(37,211,102,0.15)", border: "0.5px solid rgba(37,211,102,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={16} color="#25d366" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>Send via WhatsApp</div>
            <div style={{ fontSize: 11, color: T3 }}>Powered by 360dialog</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 4, display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {/* 24-hour window warning */}
        <div style={{
          margin: "14px 18px 0",
          padding: "10px 12px", borderRadius: 9,
          background: "rgba(251,191,36,0.08)", border: "0.5px solid rgba(251,191,36,0.3)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 11, color: T2, lineHeight: 1.6 }}>
            <strong style={{ color: "#f59e0b" }}>24-hour session window:</strong> WhatsApp Business only allows
            sending messages to customers who have messaged your number in the last 24 hours.
            If delivery fails, ask the customer to send a message to your WhatsApp number first.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Phone number</label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="923001234567 (no + or spaces)"
            />
            <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>
              Pakistan example: <code>0300 123 4567</code> → <code style={{ color: "#25d366" }}>923001234567</code>
            </div>
          </div>

          <div>
            <label style={lbl}>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`,
                borderRadius: 10, padding: "10px 12px", fontSize: 13, color: T1,
                outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
              }}
            />
          </div>

          {/* PDF attachment option */}
          {getPdfBlob && (
            <div style={{
              padding: "10px 12px", borderRadius: 9,
              background: attachPdf ? "rgba(37,211,102,0.06)" : GLASS,
              border: `0.5px solid ${attachPdf ? "rgba(37,211,102,0.3)" : GLASS_BORDER}`,
              display: "flex", alignItems: "center", gap: 10, cursor: isSandbox ? "default" : "pointer",
              opacity: isSandbox ? 0.5 : 1,
              transition: "all 0.15s",
            }}
              onClick={() => { if (!isSandbox) setAttachPdf(v => !v); }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                background: attachPdf ? "#25d366" : "transparent",
                border: `1.5px solid ${attachPdf ? "#25d366" : GLASS_BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {attachPdf && <div style={{ width: 10, height: 7, borderLeft: "2px solid #fff", borderBottom: "2px solid #fff", transform: "rotate(-45deg) translate(1px, -1px)" }} />}
              </div>
              <Paperclip size={13} color={attachPdf ? "#25d366" : T3} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: attachPdf ? "#25d366" : T1 }}>
                  Attach PDF document
                  {isSandbox && <span style={{ color: T3, fontWeight: 400 }}> (sandbox not supported)</span>}
                </div>
                {docFilename && (
                  <div style={{ fontSize: 11, color: T3 }}>{docFilename}</div>
                )}
              </div>
              {!isSandbox && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T3 }}>
                  <Info size={10} /> production only
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: T3 }}>
              Messages appear in{" "}
              <a href="/messaging" style={{ color: "#25d366", textDecoration: "none" }}>Messaging</a>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
              <Button
                size="sm"
                disabled={sending || !phone.trim() || !message.trim()}
                onClick={send}
                style={{ background: "#25d366", borderColor: "#25d366", color: "#fff" }}
              >
                <Send size={12} className="mr-1.5" />
                {sending ? (attachPdf ? "Uploading PDF…" : "Sending…") : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function buildInvoiceMessage(opts: {
  customerName: string;
  invoiceNo: string;
  amount: string;
  companyName?: string;
}) {
  return `Hi ${opts.customerName},\n\nYour Invoice *${opts.invoiceNo}* for *${opts.amount}* is ready.\n\nPlease let us know if you have any questions.\n\nThanks,\n${opts.companyName ?? ""}`.trim();
}

export function buildQuotationMessage(opts: {
  customerName: string;
  quotationNo: string;
  amount: string;
  companyName?: string;
}) {
  return `Hi ${opts.customerName},\n\nPlease find your Quotation *${opts.quotationNo}* for *${opts.amount}* attached.\n\nThis quote is valid for your review. Feel free to reach out with any questions.\n\nThanks,\n${opts.companyName ?? ""}`.trim();
}
