"use client";
import { useState, useEffect } from "react";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";

const PRESETS = [
  { id: "classic-corporate", name: "Classic Corporate", bg: "#1a2744", text: "#fff", tag: "Serif · Traditional" },
  { id: "modern-gradient", name: "Modern Gradient", bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", text: "#fff", tag: "Sans · Contemporary" },
  { id: "minimal-clean", name: "Minimal Clean", bg: "#f8f9fa", text: "#374151", tag: "Sans · Ultra-minimal" },
  { id: "executive-dark", name: "Executive Dark", bg: "#0f172a", text: "#94a3b8", tag: "Sans · Premium" },
  { id: "bold-accent", name: "Bold Accent", bg: "#fff7ed", text: "#f97316", tag: "Sans · High-impact" },
  { id: "retro-serif", name: "Retro Serif", bg: "#faf7f0", text: "#8b4513", tag: "Serif · Vintage" },
];

const PRESET_NAMES: Record<string, string> = Object.fromEntries(PRESETS.map(p => [p.id, p.name]));

export default function DocumentSettingsPage() {
  const { settings } = useSettings();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const secTitle = { fontSize: 14, fontWeight: 500, color: T1, marginBottom: 16 } as const;
  const activeInvoiceId = (settings?.lastUsed as any)?.invoiceDesignId ?? "modern-gradient";

  return (
    <>
      <div style={secTitle}>Document design</div>
      <div style={{ fontSize: 13, color: T2, marginBottom: 16, lineHeight: 1.7 }}>
        Configure how your invoices, quotations, and receipts look when printed or exported as PDFs.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
        {(["invoice", "quotation", "receipt"] as const).map(docType => {
          const key = docType === "invoice" ? "invoiceDesignId" : docType === "quotation" ? "quotationDesignId" : "receiptDesignId";
          const id = (settings?.lastUsed as any)?.[key] ?? "modern-gradient";
          const userDesign = settings?.documentDesigns?.find((d: any) => d.id === id);
          const name = userDesign?.name ?? PRESET_NAMES[id] ?? "Modern Gradient";
          return (
            <div key={docType} style={{ padding: "10px 12px", borderRadius: 10, background: GLASS, border: `0.5px solid ${GLASS_BORDER}` }}>
              <div style={{ fontSize: 9.5, color: T3, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>{docType}s</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: T1 }}>{name}</div>
              <div style={{ fontSize: 10, color: "#818cf8", marginTop: 2 }}>Default design</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
        {PRESETS.map(p => {
          const isActive = activeInvoiceId === p.id;
          return (
            <div key={p.id} style={{ borderRadius: 8, border: `1.5px solid ${isActive ? "#818cf8" : GLASS_BORDER}`, overflow: "hidden", background: GLASS, position: "relative", boxShadow: isActive ? "0 0 0 1px rgba(99,102,241,0.3)" : "none" }}>
              {isActive && (
                <div style={{ position: "absolute", top: 5, right: 7, width: 18, height: 18, borderRadius: "50%", background: "rgba(99,102,241,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 5l2 2.5L8 3" /></svg>
                </div>
              )}
              <div style={{ height: 56, background: p.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px" }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: p.text }}>Company</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: p.text }}>INV</span>
              </div>
              <div style={{ padding: "5px 8px 7px", background: "var(--glass)" }}>
                <div style={{ fontSize: isMobile ? 9.5 : 10.5, fontWeight: 500, color: T1 }}>{p.name}</div>
                <div style={{ fontSize: 9, color: T3 }}>{p.tag}</div>
              </div>
            </div>
          );
        })}
      </div>

      <a href="/settings/document-design" style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
        borderRadius: 100, background: "rgba(99,102,241,0.12)", border: "0.5px solid rgba(99,102,241,0.3)",
        color: "#818cf8", fontSize: 12, fontWeight: 500, textDecoration: "none", transition: "all 0.15s",
      }}>Open full design editor →</a>
    </>
  );
}
