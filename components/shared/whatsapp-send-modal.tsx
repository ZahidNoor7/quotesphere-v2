"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, X, Paperclip, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPhone: string;
  defaultMessage: string;
  /** If provided, enables the "Attach PDF" option */
  getPdfBlob?: () => Promise<Blob>;
  docFilename?: string;
  /** Kept for back-compat; no longer gates PDF (media goes via Cloudinary in any mode). */
  isSandbox?: boolean;
  /** Whether Cloudinary (file hosting) is configured — required to attach the PDF. */
  cloudinaryConfigured?: boolean;
  onSent?: () => void;
}

export function WhatsAppSendModal({
  open, onClose, defaultPhone, defaultMessage,
  getPdfBlob, docFilename, cloudinaryConfigured, onSent,
}: Props) {
  const [phone, setPhone] = useState(defaultPhone.replace(/\D/g, ""));
  const [message, setMessage] = useState(defaultMessage);
  const canAttachPdf = !!getPdfBlob && !!cloudinaryConfigured;
  const [attachPdf, setAttachPdf] = useState(canAttachPdf);
  const [sending, setSending] = useState(false);

  // Default the PDF on whenever the modal opens (and once Cloudinary readiness is known).
  useEffect(() => { setAttachPdf(canAttachPdf); }, [open, canAttachPdf]);

  if (!open) return null;

  async function send() {
    if (!phone.trim() || !message.trim()) {
      toast.error("Phone number and message are required");
      return;
    }
    setSending(true);
    try {
      let attachment: { dataUri: string; filename: string; mime: string } | undefined;

      if (attachPdf && getPdfBlob) {
        toast.info("Generating PDF…");
        const blob = await getPdfBlob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        attachment = {
          dataUri: `data:application/pdf;base64,${btoa(binary)}`,
          filename: docFilename ?? "document.pdf",
          mime: "application/pdf",
        };
      }

      // Unified path: the PDF is sent as a real WhatsApp document (hosted on
      // Cloudinary) with the message as its caption — works in sandbox AND production.
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone.trim(), body: message.trim(), ...(attachment ? { attachment } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");

      toast.success(attachment ? "Document sent via WhatsApp!" : "Message sent via WhatsApp!");
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
              display: "flex", alignItems: "center", gap: 10, cursor: canAttachPdf ? "pointer" : "default",
              opacity: canAttachPdf ? 1 : 0.6,
              transition: "all 0.15s",
            }}
              onClick={() => { if (canAttachPdf) setAttachPdf(v => !v); }}
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
                  {!cloudinaryConfigured && <span style={{ color: T3, fontWeight: 400 }}> (set up Cloudinary first)</span>}
                </div>
                {docFilename && cloudinaryConfigured && (
                  <div style={{ fontSize: 11, color: T3 }}>{docFilename}</div>
                )}
                {!cloudinaryConfigured && (
                  <a href="/settings/integrations" style={{ fontSize: 11, color: "#25d366", textDecoration: "none" }} onClick={e => e.stopPropagation()}>
                    Enable file hosting in Settings → Integrations
                  </a>
                )}
              </div>
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
