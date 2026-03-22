"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { T1, T2, T3, GLASS, GLASS_BORDER, TOPBAR_STYLE, FIELD_INPUT } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import {
  BUILT_IN_DESIGNS, getAllDesigns, getDesignById, getDefaultDesign,
  resolveConfig, PRESET_META, PRESET_IDS, PRESET_CONFIGS, type PresetId,
} from "@/lib/document-designs";
import type { DocumentDesign, DocumentDesignConfig } from "@/types";

type DocType = "invoice" | "quotation" | "receipt";

const SAMPLE_DATA = {
  docNo: "INV-00042",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  customer: { name: "Acme Corporation", phone: "+92 300 1234567", address: "Blue Area, Islamabad" },
  items: [
    { name: "Web Design & Development", quantity: 1, price: 75000 },
    { name: "Monthly Hosting & Support", quantity: 3, price: 5000 },
    { name: "Domain Registration", quantity: 1, price: 2500 },
  ],
  subTotal: 92500,
  taxAmt: 16650,
  taxLabel: "Tax (18%)",
  discount: 5000,
  delivery: 0,
  total: 104150,
  advance: 25000,
  outstanding: 79150,
  currency: "PKR",
  remarks: "Thank you for your business.",
};

const SAMPLE_RECEIPT_DATA = {
  docNo: "RCP-00007",
  issueDate: new Date().toISOString().slice(0, 10),
  customer: { name: "Acme Corporation", phone: "+92 300 1234567" },
  invoiceNo: "INV-00042",
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentAmount: 25000,
  paymentMethod: "bank_transfer",
  paymentRef: "TXN-88472930",
  remainingBalance: 79150,
  total: 104150,
  currency: "PKR",
};

const DOC_TABS: { id: DocType; label: string }[] = [
  { id: "invoice", label: "Invoices" },
  { id: "quotation", label: "Quotations" },
  { id: "receipt", label: "Receipts" },
];

const SETTINGS_TABS = ["Header", "Footer", "Content", "Page & Style"] as const;

const FONT_OPTIONS = [
  { value: "'Inter', system-ui, -apple-system, sans-serif", label: "Inter (Modern)" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia (Serif)" },
  { value: "'Courier New', Courier, monospace", label: "Courier (Mono)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial (Classic)" },
];

export default function DocumentDesignPage() {
  const router = useRouter();
  const { settings, mutate } = useSettings();
  const userDesigns = settings?.documentDesigns ?? [];

  const [activeDocType, setActiveDocType] = useState<DocType>("invoice");
  const [activeSettingsTab, setActiveSettingsTab] = useState<typeof SETTINGS_TABS[number]>("Header");
  const [selectedDesignId, setSelectedDesignId] = useState<string>("modern-gradient");
  const [configOverrides, setConfigOverrides] = useState<Partial<DocumentDesignConfig>>({});
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);

  const allDesigns = getAllDesigns(userDesigns, activeDocType);
  const baseDesign = getDesignById(selectedDesignId, userDesigns);
  const baseConfig = resolveConfig(baseDesign);
  const effectiveConfig: any = { ...baseConfig, ...configOverrides };

  // The design being previewed (base + overrides)
  const previewDesign: DocumentDesign = {
    ...baseDesign,
    config: effectiveConfig,
  };

  // Get default design id for active doc type
  const defaultDesignId = (() => {
    const lastUsedKey = activeDocType === "invoice" ? "invoiceDesignId"
      : activeDocType === "quotation" ? "quotationDesignId"
      : "receiptDesignId";
    return (settings?.lastUsed as any)?.[lastUsedKey] ?? "modern-gradient";
  })();

  function selectDesign(id: string) {
    setSelectedDesignId(id);
    setConfigOverrides({}); // Reset overrides when switching design
  }

  function updateConfig(updates: Partial<DocumentDesignConfig>) {
    setConfigOverrides(prev => ({ ...prev, ...updates }));
  }

  async function setAsDefault() {
    setSettingDefault(true);
    try {
      const res = await fetch(`/api/settings/document-designs/${selectedDesignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeDocType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Set as default for ${activeDocType}s.`);
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSettingDefault(false);
    }
  }

  async function saveAsCustom() {
    if (!customName.trim()) { toast.error("Enter a name for the design."); return; }
    setSavingCustom(true);
    try {
      const res = await fetch("/api/settings/document-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          type: activeDocType,
          config: effectiveConfig,
          isDefault: false,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Custom design saved.");
      setCustomName("");
      setShowSaveAs(false);
      mutate();
      setSelectedDesignId(data.data.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCustom(false);
    }
  }

  async function deleteUserDesign(id: string) {
    if (!confirm("Delete this custom design?")) return;
    try {
      const res = await fetch(`/api/settings/document-designs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Design deleted.");
      mutate();
      if (selectedDesignId === id) setSelectedDesignId("modern-gradient");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const isUserDesign = userDesigns.some(d => d.id === selectedDesignId);
  const sampleData = activeDocType === "receipt" ? SAMPLE_RECEIPT_DATA : SAMPLE_DATA;

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;
  const secHd = { fontSize: 10, fontWeight: 600, color: T3, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 };

  const PICKER_PREVIEWS: Record<string, { bg: string; text: string }> = {
    "classic-corporate": { bg: "#1a2744", text: "#fff" },
    "modern-gradient":   { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", text: "#fff" },
    "minimal-clean":     { bg: "#f8f9fa", text: "#374151" },
    "executive-dark":    { bg: "#0f172a", text: "#94a3b8" },
    "bold-accent":       { bg: "#fff7ed", text: "#f97316" },
    "retro-serif":       { bg: "#faf7f0", text: "#8b4513" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{ ...TOPBAR_STYLE }}>
        <Link href="/settings" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, cursor: "pointer", textDecoration: "none" }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4"/></svg>
          Settings
        </Link>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Document Design</div>
      </div>

      {/* Doc type tabs */}
      <div style={{ display: "flex", gap: 2, padding: "8px 20px", borderBottom: `0.5px solid ${GLASS_BORDER}`, background: "rgba(10,14,28,0.4)", flexShrink: 0 }}>
        {DOC_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveDocType(tab.id)}
            style={{
              padding: "5px 16px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer",
              border: "none", transition: "all 0.15s",
              background: activeDocType === tab.id ? "rgba(99,102,241,0.2)" : "transparent",
              color: activeDocType === tab.id ? "#818cf8" : T3,
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Main layout: left panel + right preview */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left panel: design grid + settings ── */}
        <div style={{ width: 320, flexShrink: 0, borderRight: `0.5px solid ${GLASS_BORDER}`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Design grid */}
          <div style={{ padding: "14px 14px 0" }}>
            <div style={secHd}>Select Design</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 12 }}>
              {allDesigns.map(d => {
                const preset = (d.config.preset ?? "modern-gradient") as string;
                const meta = PICKER_PREVIEWS[preset] ?? PICKER_PREVIEWS["modern-gradient"];
                const isSelected = selectedDesignId === d.id;
                const isDefault = defaultDesignId === d.id;
                const isUser = userDesigns.some(u => u.id === d.id);
                const pmeta = PRESET_META[preset as PresetId];
                return (
                  <div key={d.id} style={{ position: "relative" }}>
                    <button
                      onClick={() => selectDesign(d.id)}
                      style={{
                        width: "100%", padding: 0, border: `1.5px solid ${isSelected ? "#818cf8" : isDefault ? "rgba(99,102,241,0.4)" : GLASS_BORDER}`,
                        borderRadius: 8, overflow: "hidden", cursor: "pointer", background: isSelected ? "rgba(99,102,241,0.08)" : GLASS,
                        transition: "all 0.15s", textAlign: "left",
                        boxShadow: isSelected ? "0 0 0 1px rgba(99,102,241,0.3)" : "none",
                      }}
                    >
                      {isDefault && !isSelected && (
                        <div style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "#6366f1", zIndex: 1 }} />
                      )}
                      {isSelected && (
                        <div style={{ position: "absolute", top: 4, right: 4, zIndex: 1, width: 14, height: 14, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 5l2.5 2.5L8 3"/></svg>
                        </div>
                      )}
                      <div style={{ height: 50, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
                        <span style={{ fontSize: 7, fontWeight: 700, color: meta.text, opacity: 0.9 }}>Co.</span>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: meta.text, opacity: 0.9 }}>INV</span>
                      </div>
                      <div style={{ padding: "5px 7px 6px" }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                        {pmeta && <div style={{ fontSize: 8.5, color: T3 }}>{pmeta.tag}</div>}
                      </div>
                    </button>
                    {isUser && (
                      <button
                        onClick={() => deleteUserDesign(d.id)}
                        style={{ position: "absolute", bottom: 5, right: 4, width: 16, height: 16, borderRadius: 4, background: "rgba(248,113,113,0.15)", border: "0.5px solid rgba(248,113,113,0.3)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}
                        title="Delete"
                      >×</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settings tabs */}
          <div style={{ flex: 1, borderTop: `0.5px solid ${GLASS_BORDER}` }}>
            <div style={{ display: "flex", gap: 1, padding: "8px 14px 0" }}>
              {SETTINGS_TABS.map(tab => (
                <button key={tab} onClick={() => setActiveSettingsTab(tab)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 500, cursor: "pointer",
                    border: "none", transition: "all 0.15s",
                    background: activeSettingsTab === tab ? "rgba(99,102,241,0.18)" : "transparent",
                    color: activeSettingsTab === tab ? "#818cf8" : T3,
                  }}
                >{tab}</button>
              ))}
            </div>

            <div style={{ padding: "12px 14px" }}>
              {/* Header tab */}
              {activeSettingsTab === "Header" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={lbl}>Header background</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        { label: "Navy", value: "#1a2744" },
                        { label: "Indigo", value: "#6366f1" },
                        { label: "Dark", value: "#0f172a" },
                        { label: "White", value: "#ffffff" },
                        { label: "Warm", value: "#faf7f0" },
                        { label: "Orange", value: "#fff7ed" },
                      ].map(c => (
                        <button key={c.value}
                          onClick={() => updateConfig({ headerBg: c.value })}
                          title={c.label}
                          style={{
                            width: 22, height: 22, borderRadius: 5, background: c.value, cursor: "pointer",
                            border: effectiveConfig.headerBg === c.value ? "2px solid #818cf8" : "1px solid rgba(255,255,255,0.2)",
                          }}
                        />
                      ))}
                      <input type="color" value={effectiveConfig.headerBg?.startsWith("#") ? effectiveConfig.headerBg : "#6366f1"}
                        onChange={e => updateConfig({ headerBg: e.target.value })}
                        style={{ width: 22, height: 22, borderRadius: 5, border: "none", cursor: "pointer", padding: 0 }}
                        title="Custom color"
                      />
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <button
                        onClick={() => updateConfig({ headerBg: "linear-gradient(135deg, #6366f1, #8b5cf6)" })}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 100, border: `0.5px solid ${GLASS_BORDER}`, background: effectiveConfig.headerBg?.includes("gradient") ? "rgba(99,102,241,0.2)" : GLASS, color: T2, cursor: "pointer" }}
                      >Indigo Gradient</button>
                      <button
                        onClick={() => updateConfig({ headerBg: "linear-gradient(135deg, #1e293b, #334155)" })}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 100, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS, color: T2, cursor: "pointer", marginLeft: 4 }}
                      >Dark Gradient</button>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Accent colour</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["#6366f1","#8b5cf6","#f97316","#c8a96e","#94a3b8","#374151","#16a34a","#dc2626","#8b4513"].map(c => (
                        <button key={c} onClick={() => updateConfig({ accentColor: c })}
                          style={{ width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer", border: effectiveConfig.accentColor === c ? "2px solid #fff" : "none", boxShadow: effectiveConfig.accentColor === c ? `0 0 0 2px ${c}60` : "none" }}
                        />
                      ))}
                      <input type="color" value={effectiveConfig.accentColor ?? "#6366f1"}
                        onChange={e => updateConfig({ accentColor: e.target.value })}
                        style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { key: "showLogo" as const, label: "Show company logo" },
                      { key: "showAddress" as const, label: "Show company address" },
                      { key: "showPhone" as const, label: "Show company phone" },
                    ].map(({ key, label }) => (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <div
                          onClick={() => updateConfig({ [key]: !effectiveConfig[key] })}
                          style={{ width: 30, height: 16, borderRadius: 100, background: effectiveConfig[key] ? "#6366f1" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
                        >
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: effectiveConfig[key] ? 16 : 2, transition: "left 0.2s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: T2 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer tab */}
              {activeSettingsTab === "Footer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={lbl}>Footer text</label>
                    <input
                      value={effectiveConfig.footerText ?? ""}
                      onChange={e => updateConfig({ footerText: e.target.value })}
                      placeholder="Thank you for your business."
                      style={FIELD_INPUT}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <div
                      onClick={() => updateConfig({ showTerms: !effectiveConfig.showTerms })}
                      style={{ width: 30, height: 16, borderRadius: 100, background: effectiveConfig.showTerms ? "#6366f1" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
                    >
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: effectiveConfig.showTerms ? 16 : 2, transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: T2 }}>Show terms & conditions</span>
                  </label>
                </div>
              )}

              {/* Content tab */}
              {activeSettingsTab === "Content" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={lbl}>Table style</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["striped", "bordered", "minimal"] as const).map(s => (
                        <button key={s}
                          onClick={() => updateConfig({ tableStyle: s })}
                          style={{
                            flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 10.5, cursor: "pointer", border: `1px solid ${effectiveConfig.tableStyle === s ? "#818cf8" : GLASS_BORDER}`,
                            background: effectiveConfig.tableStyle === s ? "rgba(99,102,241,0.18)" : GLASS,
                            color: effectiveConfig.tableStyle === s ? "#818cf8" : T2,
                            textTransform: "capitalize",
                          }}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { key: "showTax" as const, label: "Show tax line" },
                      { key: "showDiscount" as const, label: "Show discount line" },
                    ].map(({ key, label }) => (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <div
                          onClick={() => updateConfig({ [key]: !effectiveConfig[key] })}
                          style={{ width: 30, height: 16, borderRadius: 100, background: effectiveConfig[key] ? "#6366f1" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
                        >
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: effectiveConfig[key] ? 16 : 2, transition: "left 0.2s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: T2 }}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Page & Style tab */}
              {activeSettingsTab === "Page & Style" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={lbl}>Font family</label>
                    <select
                      value={effectiveConfig.fontFamily ?? FONT_OPTIONS[0].value}
                      onChange={e => updateConfig({ fontFamily: e.target.value })}
                      style={{ ...FIELD_INPUT, cursor: "pointer" }}
                    >
                      {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Watermark text</label>
                    <input
                      value={effectiveConfig.watermark ?? ""}
                      onChange={e => updateConfig({ watermark: e.target.value })}
                      placeholder="e.g. DRAFT, PAID, CONFIDENTIAL"
                      style={FIELD_INPUT}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: "10px 14px 14px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", flexDirection: "column", gap: 6 }}>
            <Button
              loading={settingDefault}
              onClick={setAsDefault}
              style={{ width: "100%" }}
            >
              Set as default for {activeDocType}s
            </Button>
            <button
              onClick={() => setShowSaveAs(v => !v)}
              style={{ width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 500, color: T2, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, cursor: "pointer" }}
            >
              Save as custom design
            </button>
            {showSaveAs && (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Design name"
                  style={{ ...FIELD_INPUT, flex: 1, fontSize: 11 }}
                  onKeyDown={e => e.key === "Enter" && saveAsCustom()}
                />
                <Button size="sm" loading={savingCustom} onClick={saveAsCustom}>Save</Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: A4 preview ── */}
        <div style={{ flex: 1, background: "#111827", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px" }}>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: T3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Preview — {previewDesign.name}</span>
            {defaultDesignId === selectedDesignId && (
              <span style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 100, background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "0.5px solid rgba(99,102,241,0.3)" }}>
                Default for {activeDocType}s
              </span>
            )}
          </div>
          <div style={{ boxShadow: "0 12px 60px rgba(0,0,0,0.7)", borderRadius: 4, overflow: "hidden", width: 595 }}>
            <DocumentRenderer
              design={previewDesign}
              width={595}
              data={{
                type: activeDocType,
                ...sampleData,
                companyName: settings?.company_name ?? "Your Company",
                companyEmail: settings?.company_email,
                companyPhone: settings?.company_phone,
                companyAddress: settings?.company_address,
                termsText: settings?.terms_and_conditions ?? "Payment due within 30 days. Late payments are subject to a 2% monthly interest charge. All disputes to be resolved under applicable law.",
              }}
            />
          </div>
          <p style={{ fontSize: 10.5, color: T3, marginTop: 14, textAlign: "center" }}>
            This preview uses sample data. Your actual documents will reflect real client and transaction data.
          </p>
        </div>
      </div>
    </div>
  );
}
