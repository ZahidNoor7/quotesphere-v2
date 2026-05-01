"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { T1, T3, GLASS_BORDER } from "@/lib/ds";
import type { Settings } from "@/types";
import { useSettings } from "@/hooks/use-settings";
import { CurrencyRatesPanel } from "@/components/settings/currency-rates-panel";

const CURRENCIES = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
];

export default function GeneralSettingsPage() {
  const { settings, mutate } = useSettings();
  const [form, setForm] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const f = (key: keyof Settings) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

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

  return (
    <>
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

      <div style={{ borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 16, marginBottom: 12 }}>
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
          <div><label style={lbl}>Invoice prefix</label><Input {...f("invoice_prefix")} placeholder="INV-" /></div>
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
