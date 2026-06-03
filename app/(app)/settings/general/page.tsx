"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import type { Settings } from "@/types";
import { useSettings } from "@/hooks/use-settings";
import { IntegrationGateNotice } from "@/components/integrations/IntegrationGateNotice";
import { CurrencyRatesPanel } from "@/components/settings/currency-rates-panel";
import { Upload, X, Globe, Link2 } from "lucide-react";

const CURRENCIES = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
];

const SOCIAL_FIELDS: { key: string; label: string; placeholder: string; icon: React.ElementType }[] = [
  { key: "website", label: "Website", placeholder: "https://company.com", icon: Globe },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/...", icon: Link2 },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/...", icon: Link2 },
  { key: "twitter", label: "Twitter / X", placeholder: "https://twitter.com/...", icon: Link2 },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/...", icon: Link2 },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/...", icon: Link2 },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/...", icon: Link2 },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+92 300 1234567", icon: Link2 },
];

export default function GeneralSettingsPage() {
  const { settings, mutate } = useSettings();
  const cloudinaryConfigured = !!settings?.cloudinaryConfigured;
  const [form, setForm] = useState<Partial<Settings> & { social_links?: Record<string, string> }>({});
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (settings) setForm({ ...settings, social_links: settings.social_links as any ?? {} });
  }, [settings]);

  const f = (key: keyof Settings) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  function setSocial(key: string, val: string) {
    setForm(p => ({ ...p, social_links: { ...(p.social_links ?? {}), [key]: val } }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_MB = 5;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file (PNG, JPG, SVG, WebP…).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Logo is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${MAX_MB} MB.`);
      e.target.value = "";
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "quotesphere/logos");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const url = data.data.url;
      // Update local form state
      setForm(p => ({ ...p, company_logo: url }));
      // Auto-save the URL to the database immediately so refresh doesn't lose it
      const saveRes = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_logo: url }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error);
      mutate();
      toast.success("Logo uploaded and saved.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function save() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Settings saved.");
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;
  const secTitle = { fontSize: 14, fontWeight: 500, color: T1, marginBottom: 16 } as const;
  const col2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 } as const;
  const divider = { borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 16, marginBottom: 12 } as const;

  return (
    <>
      {/* ── Company logo ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={secTitle}>Company logo</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 12, border: `1px dashed ${GLASS_BORDER}`, background: GLASS, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {form.company_logo ? (
              <img src={form.company_logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 22, color: T3 }}>Q</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                loading={logoUploading}
                disabled={!cloudinaryConfigured}
                title={!cloudinaryConfigured ? "Set up Cloudinary in Settings → Integrations first" : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={12} className="mr-1.5" />Upload logo
              </Button>
              {form.company_logo && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    setForm(p => ({ ...p, company_logo: "" }));
                    await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ company_logo: "" }),
                    });
                    mutate();
                  }}
                >
                  <X size={12} className="mr-1.5" />Remove
                </Button>
              )}
            </div>
            {cloudinaryConfigured ? (
              <div style={{ fontSize: 11, color: T3 }}>PNG, JPG, SVG · max 5 MB · used in invoices, quotations, and app UI</div>
            ) : (
              <IntegrationGateNotice
                title="Image hosting isn't set up"
                detail="Connect Cloudinary to upload your logo, product photos and bill scans."
              />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} />
        </div>
      </div>

      {/* ── Company info ── */}
      <div style={secTitle}>Company information</div>
      <div style={col2}>
        <div><label style={lbl}>Company name</label><Input {...f("company_name")} placeholder="QuoteSphere Solutions" /></div>
        <div><label style={lbl}>Company email</label><Input {...f("company_email")} type="email" placeholder="hello@company.com" /></div>
      </div>
      <div style={col2}>
        <div><label style={lbl}>Phone</label><Input {...f("company_phone")} placeholder="+92 42 1234567" /></div>
        <div><label style={lbl}>Tax / NTN number</label><Input value={(form as any).tax_id ?? ""} onChange={(e: any) => setForm((p: any) => ({ ...p, tax_id: e.target.value }))} placeholder="NTN-7654321" /></div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Address</label>
        <Textarea {...(f("company_address") as any)} placeholder="Street, City, Country" rows={2} style={{ height: 58 }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Company bio / tagline</label>
        <Textarea {...(f("company_bio") as any)} placeholder="A short description of your business..." rows={2} style={{ height: 58 }} />
      </div>

      {/* ── Social & web links ── */}
      <div style={divider}>
        <div style={{ ...secTitle, fontSize: 13 }}>Website & social links</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          {SOCIAL_FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Icon size={13} style={{ position: "absolute", left: 10, color: T3, flexShrink: 0, pointerEvents: "none" }} />
                <Input
                  value={(form.social_links as any)?.[key] ?? ""}
                  onChange={e => setSocial(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ paddingLeft: 30 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Default document settings ── */}
      <div style={divider}>
        <div style={{ ...secTitle, fontSize: 13 }}>Default document settings</div>
        <div style={col2}>
          <div>
            <label style={lbl}>Default currency</label>
            <Select value={f("default_currency").value} onValueChange={v => setForm(p => ({ ...p, default_currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div><label style={lbl}>Invoice prefix</label><Input {...f("invoice_prefix")} placeholder="INV" /></div>
        </div>
        <div style={col2}>
          <div><label style={lbl}>Quotation prefix</label><Input {...f("quotation_prefix")} placeholder="QT" /></div>
          <div><label style={lbl}>Expense prefix</label><Input {...f("expense_prefix")} placeholder="EXP" /></div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Number patterns</label>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8, lineHeight: 1.6 }}>
            Tokens: <code style={{ background: "var(--glass)", padding: "1px 5px", borderRadius: 4 }}>{"{prefix}"}</code>{" "}
            <code style={{ background: "var(--glass)", padding: "1px 5px", borderRadius: 4 }}>{"{YYYY}"}</code>{" "}
            <code style={{ background: "var(--glass)", padding: "1px 5px", borderRadius: 4 }}>{"{YY}"}</code>{" "}
            <code style={{ background: "var(--glass)", padding: "1px 5px", borderRadius: 4 }}>{"{MM}"}</code>{" "}
            <code style={{ background: "var(--glass)", padding: "1px 5px", borderRadius: 4 }}>{"{seq:5}"}</code>{" "}
            — leave blank for <code style={{ background: "var(--glass)", padding: "1px 5px", borderRadius: 4 }}>{"{prefix}-{seq:5}"}</code>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ ...lbl, color: "var(--t3)" }}>Invoice pattern</label>
              <Input {...f("invoice_number_pattern")} placeholder="{prefix}-{YYYY}-{seq:5}" />
            </div>
            <div>
              <label style={{ ...lbl, color: "var(--t3)" }}>Quotation pattern</label>
              <Input {...f("quotation_number_pattern")} placeholder="{prefix}-{seq:5}" />
            </div>
            <div>
              <label style={{ ...lbl, color: "var(--t3)" }}>Expense pattern</label>
              <Input {...f("expense_number_pattern")} placeholder="{prefix}-{seq:5}" />
            </div>
          </div>
        </div>
        <div style={col2}>
          <div><label style={lbl}>Payment terms (days)</label><Input type="number" value={form.default_payment_terms ?? 30} onChange={(e: any) => setForm((p: any) => ({ ...p, default_payment_terms: parseInt(e.target.value) || 30 }))} /></div>
          <div><label style={lbl}>Default tax rate (%)</label><Input type="number" value={form.default_tax ?? 0} onChange={(e: any) => setForm((p: any) => ({ ...p, default_tax: parseFloat(e.target.value) || 0 }))} /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>Terms & conditions</label>
          <Textarea {...(f("terms_and_conditions") as any)} placeholder="Payment due within 30 days..." rows={4} style={{ height: 80 }} />
        </div>
      </div>

      <Button loading={loading} onClick={save} style={{ marginBottom: 28 }}>Save changes</Button>

      <div style={{ borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 20 }}>
        <div style={{ ...secTitle, fontSize: 13 }}>Currency rates</div>
        <CurrencyRatesPanel />
      </div>
    </>
  );
}
