"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { T1, T2, T3, GLASS, GLASS_BORDER, TOPBAR_STYLE, FIELD_INPUT } from "@/lib/ds";
import type { Settings } from "@/types";
import { useSettings } from "@/hooks/use-settings";
import { THEMES, applyTheme } from "@/lib/themes";
import { useTheme } from "@/components/layout/theme-provider";
import { CurrencyRatesPanel } from "@/components/settings/currency-rates-panel";

const SETTINGS_NAV = [
  "Company info", "Document design", "Currencies",
  "App appearance", "Team & roles", "Danger zone",
];

const CURRENCIES = [
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
];

const ACCENT_COLORS = [
  ["#6366f1", "Indigo"],
  ["#8b5cf6", "Violet"],
  ["#3b82f6", "Blue"],
  ["#14b8a6", "Teal"],
  ["#10b981", "Emerald"],
  ["#f97316", "Orange"],
] as const;

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

export default function SettingsPage() {
  const [activeNav, setActiveNav] = useState("Company info");
  const { settings, mutate, updateAppearance } = useSettings();
  const { themeId: currentThemeId, setTheme } = useTheme();
  const [form, setForm] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const f = (key: keyof Settings) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  async function save() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Settings saved."); mutate();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  const accentColor = settings?.appearance?.accentColor ?? "#6366f1";
  const sidebarCollapsed = settings?.appearance?.sidebarCollapsed ?? false;

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;
  const secTitle = { fontSize: 14, fontWeight: 500, color: T1, marginBottom: 16 } as const;
  const col2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 } as const;
  const col3 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 18 } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Desktop-only topbar — MobileNav in AppShell already covers mobile */}
      {!isMobile && (
        <div style={TOPBAR_STYLE}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Settings</div>
        </div>
      )}

      {isMobile ? (
        /* ── Mobile layout: horizontal scrollable tabs + content ── */
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Horizontal nav tabs (acts as the page header on mobile) */}
          <div style={{
            display: "flex",
            overflowX: "auto",
            borderBottom: `0.5px solid ${GLASS_BORDER}`,
            background: "var(--glass-surface-bg)",
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            padding: "0 4px",
            flexShrink: 0,
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}>
            {SETTINGS_NAV.map(n => (
              <button key={n} onClick={() => setActiveNav(n)}
                style={{
                  flexShrink: 0,
                  padding: "11px 13px",
                  border: "none",
                  borderBottom: activeNav === n ? "2px solid #818cf8" : "2px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: activeNav === n ? 600 : 400,
                  color: activeNav === n ? "#818cf8" : n === "Danger zone" ? "#f87171" : T2,
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                  marginBottom: -1,
                }}
              >{n}</button>
            ))}
          </div>

          {/* Scrollable content */}
          <div style={{ padding: "16px 14px", overflowY: "auto", flex: 1 }}>
            <SettingsContent
              activeNav={activeNav} isMobile={isMobile}
              settings={settings} form={form} setForm={setForm}
              loading={loading} save={save}
              f={f} lbl={lbl} secTitle={secTitle} col2={col2} col3={col3}
              sidebarCollapsed={sidebarCollapsed}
              currentThemeId={currentThemeId} setTheme={setTheme}
              updateAppearance={updateAppearance}
            />
          </div>
        </div>
      ) : (
        /* ── Desktop layout: left sidebar + content ── */
        <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Left nav */}
          <div style={{ padding: "12px 8px", borderRight: `0.5px solid ${GLASS_BORDER}`, overflowY: "auto" }}>
            {SETTINGS_NAV.map(n => (
              <div key={n} onClick={() => setActiveNav(n)}
                style={{
                  padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, marginBottom: 2,
                  transition: "background 0.15s",
                  ...(activeNav === n
                    ? { background: "rgba(99,102,241,0.15)", color: "#818cf8" }
                    : n === "Danger zone"
                      ? { color: "#f87171" }
                      : { color: T2 }),
                }}
                onMouseEnter={e => { if (activeNav !== n) (e.target as HTMLElement).style.background = GLASS; }}
                onMouseLeave={e => { if (activeNav !== n) (e.target as HTMLElement).style.background = ""; }}
              >{n}</div>
            ))}
          </div>

          {/* Right content */}
          <div style={{ padding: 20, overflowY: "auto" }}>
            <SettingsContent
              activeNav={activeNav} isMobile={isMobile}
              settings={settings} form={form} setForm={setForm}
              loading={loading} save={save}
              f={f} lbl={lbl} secTitle={secTitle} col2={col2} col3={col3}
              sidebarCollapsed={sidebarCollapsed}
              currentThemeId={currentThemeId} setTheme={setTheme}
              updateAppearance={updateAppearance}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared content renderer ── */
function SettingsContent({
  activeNav, isMobile, settings, form, setForm, loading, save,
  f, lbl, secTitle, col2, col3, sidebarCollapsed,
  currentThemeId, setTheme, updateAppearance,
}: any) {
  return (
    <>
      {/* ── Company info ── */}
      {activeNav === "Company info" && (
        <>
          <div style={secTitle}>Company information</div>
          <div style={col2}>
            <div><label style={lbl}>Company name</label><Input {...f("company_name")} placeholder="QuoteSphere Solutions" /></div>
            <div><label style={lbl}>Company email</label><Input {...f("company_email")} type="email" placeholder="hello@quotesphere.pk" /></div>
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
                      {CURRENCIES.map((c: any) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
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

          <Button loading={loading} onClick={save}>Save changes</Button>
        </>
      )}

      {/* ── Document design ── */}
      {activeNav === "Document design" && (
        <div>
          <div style={secTitle}>Document design</div>
          <div style={{ fontSize: 13, color: T2, marginBottom: 16, lineHeight: 1.7 }}>
            Configure how your invoices, quotations, and receipts look when printed or exported as PDFs.
          </div>
          {/* Active design per document type */}
          <div style={col3}>
            {(["invoice", "quotation", "receipt"] as const).map(docType => {
              const lastUsedKey = docType === "invoice" ? "invoiceDesignId" : docType === "quotation" ? "quotationDesignId" : "receiptDesignId";
              const activeId = (settings?.lastUsed as any)?.[lastUsedKey] ?? "modern-gradient";
              const DESIGN_NAMES: Record<string, string> = {
                "classic-corporate": "Classic Corporate", "modern-gradient": "Modern Gradient",
                "minimal-clean": "Minimal Clean", "executive-dark": "Executive Dark",
                "bold-accent": "Bold Accent", "retro-serif": "Retro Serif",
              };
              const userDesign = settings?.documentDesigns?.find((d: any) => d.id === activeId);
              const activeName = userDesign?.name ?? DESIGN_NAMES[activeId] ?? "Modern Gradient";
              return (
                <div key={docType} style={{ padding: "10px 12px", borderRadius: 10, background: GLASS, border: `0.5px solid ${GLASS_BORDER}` }}>
                  <div style={{ fontSize: 9.5, color: T3, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>{docType}s</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T1 }}>{activeName}</div>
                  <div style={{ fontSize: 10, color: "#818cf8", marginTop: 2 }}>Default design</div>
                </div>
              );
            })}
          </div>
          {/* 6 preset preview cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)",
            gap: 8,
            marginBottom: 18,
          }}>
            {[
              { id: "classic-corporate", name: "Classic Corporate", bg: "#1a2744", text: "#fff", tag: "Serif · Traditional" },
              { id: "modern-gradient", name: "Modern Gradient", bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", text: "#fff", tag: "Sans · Contemporary" },
              { id: "minimal-clean", name: "Minimal Clean", bg: "#f8f9fa", text: "#374151", tag: "Sans · Ultra-minimal" },
              { id: "executive-dark", name: "Executive Dark", bg: "#0f172a", text: "#94a3b8", tag: "Sans · Premium" },
              { id: "bold-accent", name: "Bold Accent", bg: "#fff7ed", text: "#f97316", tag: "Sans · High-impact" },
              { id: "retro-serif", name: "Retro Serif", bg: "#faf7f0", text: "#8b4513", tag: "Serif · Vintage" },
            ].map(p => {
              const isActiveInvoice = ((settings?.lastUsed as any)?.invoiceDesignId ?? "modern-gradient") === p.id;
              return (
                <div key={p.id} style={{ borderRadius: 8, border: `1.5px solid ${isActiveInvoice ? "#818cf8" : GLASS_BORDER}`, overflow: "hidden", background: GLASS, position: "relative", boxShadow: isActiveInvoice ? "0 0 0 1px rgba(99,102,241,0.3)" : "none" }}>
                  {isActiveInvoice && (
                    <div style={{ position: "absolute", top: 5, right: 7, width: 18, height: 18, borderRadius: "50%", background: "rgba(99,102,241,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 5l2 2.5L8 3"/></svg>
                    </div>
                  )}
                  <div style={{ height: 56, background: p.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px" }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: p.text }}>Company</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: p.text }}>INV</span>
                  </div>
                  <div style={{ padding: "5px 8px 7px", background: "rgba(255,255,255,0.025)" }}>
                    <div style={{ fontSize: isMobile ? 9.5 : 10.5, fontWeight: 500, color: T1 }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: T3 }}>{p.tag}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <a href="/settings/document-design" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
            borderRadius: 100, background: "rgba(99,102,241,0.12)", border: `0.5px solid rgba(99,102,241,0.3)`,
            color: "#818cf8", fontSize: 12, fontWeight: 500, textDecoration: "none", transition: "all 0.15s",
          }}>Open full design editor →</a>
        </div>
      )}

      {/* ── Currencies ── */}
      {activeNav === "Currencies" && <CurrencyRatesPanel />}

      {/* ── App appearance ── */}
      {activeNav === "App appearance" && (
        <div>
          <div style={secTitle}>App appearance</div>
          <div style={{ fontSize: 12, color: T3, marginBottom: 20 }}>
            Choose a theme. Changes apply instantly and sync across all your devices.
          </div>

          {/* Theme grid */}
          <div style={{ fontSize: 12, color: T2, fontWeight: 500, marginBottom: 10 }}>Theme</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
            {THEMES.map((theme: any) => {
              const activeId = settings?.appearance?.themeId ?? currentThemeId ?? "dark";
              const isActive = activeId === theme.id;
              const isDarkTheme = theme.base !== "light";

              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    updateAppearance({ themeId: theme.id });
                  }}
                  style={{
                    borderRadius: 10,
                    border: `1.5px solid ${isActive ? theme.accent : GLASS_BORDER}`,
                    overflow: "hidden",
                    cursor: "pointer",
                    boxShadow: isActive ? `0 0 0 1px ${theme.accent}40` : "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    position: "relative",
                  }}
                >
                  {/* Mini app preview */}
                  <div style={{
                    height: 64,
                    display: "flex",
                    background: theme.bg === "auto" ? "#0d1120" : theme.bg,
                  }}>
                    {/* Sidebar strip */}
                    <div style={{
                      width: 30,
                      background: isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: "8px 6px",
                      borderRight: `0.5px solid ${isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                    }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: theme.accent, marginBottom: 4 }} />
                      <div style={{ height: 3, background: theme.accent, borderRadius: 2, opacity: 0.9 }} />
                      <div style={{ height: 3, background: isDarkTheme ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)", borderRadius: 2, width: "80%" }} />
                      <div style={{ height: 3, background: isDarkTheme ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)", borderRadius: 2, width: "65%" }} />
                      <div style={{ height: 3, background: isDarkTheme ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)", borderRadius: 2, width: "75%" }} />
                    </div>
                    {/* Content area */}
                    <div style={{ flex: 1, padding: "7px 9px", display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ height: 4, background: isDarkTheme ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)", borderRadius: 2, width: "45%" }} />
                      <div style={{ display: "flex", gap: 5 }}>
                        <div style={{ height: 16, flex: 1, background: isDarkTheme ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", borderRadius: 5, border: `0.5px solid ${isDarkTheme ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)"}` }} />
                        <div style={{ height: 16, flex: 1, background: isDarkTheme ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", borderRadius: 5, border: `0.5px solid ${isDarkTheme ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)"}` }} />
                      </div>
                      <div style={{ height: 9, background: theme.accent, borderRadius: 100, width: 38, opacity: 0.9 }} />
                    </div>
                  </div>
                  {/* Label row */}
                  <div style={{
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: isDarkTheme ? T1 : "#0f172a" }}>
                      {theme.name}
                    </span>
                    {isActive && (
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        background: theme.accent,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5">
                          <path d="M2 5l2 2.5L8 3" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar state */}
          <div style={{ fontSize: 12, color: T2, fontWeight: 500, marginBottom: 8 }}>Default sidebar state</div>
          <RadioGroup
            value={sidebarCollapsed ? "collapsed" : "expanded"}
            onValueChange={v => updateAppearance({ sidebarCollapsed: v === "collapsed" })}
            className="gap-1.5"
          >
            {([["expanded", "Show labels by default"], ["collapsed", "Icon-only, more screen space"]] as const).map(([v, l]) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS, cursor: "pointer" }}>
                <RadioGroupItem value={v} />
                <span style={{ fontSize: 12, color: T2 }}>{l}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* ── Team & roles ── */}
      {activeNav === "Team & roles" && (
        <div>
          <div style={{ ...secTitle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
            <span>Team & roles</span>
            <Button size="sm">+ Invite member</Button>
          </div>

          {isMobile ? (
            /* Mobile: card view instead of table */
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {[{ n: "You (Owner)", e: "admin@company.com", r: "Admin", rc: "#818cf8" }].map(u => (
                <div key={u.e} style={{ padding: "12px 14px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{u.n}</div>
                    <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 100, background: "rgba(99,102,241,0.15)", color: u.rc, border: `0.5px solid rgba(99,102,241,0.25)`, flexShrink: 0 }}>{u.r}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T3 }}>{u.e}</div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop: table view */
            <div style={{ borderRadius: 12, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden", marginBottom: 18 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["Member", "Email", "Role", ""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[{ n: "You (Owner)", e: "admin@company.com", r: "Admin", rc: "#818cf8" }].map(u => (
                    <tr key={u.e}>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500 }}>{u.n}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{u.e}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 100, background: "rgba(99,102,241,0.15)", color: u.rc, border: `0.5px solid rgba(99,102,241,0.25)` }}>{u.r}</span>
                      </td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3, fontSize: 11 }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Danger zone ── */}
      {activeNav === "Danger zone" && (
        <div>
          <div style={{ ...secTitle, color: "#f87171" }}>Danger zone</div>
          <div style={{ padding: 16, borderRadius: 10, border: "0.5px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#f87171", marginBottom: 6 }}>Delete all data</div>
            <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>This will permanently delete all invoices, quotations, clients, expenses and projects. This action cannot be undone.</div>
            <Button variant="destructive" size="sm">Delete all data</Button>
          </div>
          <div style={{ padding: 16, borderRadius: 10, border: "0.5px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#f87171", marginBottom: 6 }}>Delete account</div>
            <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>Permanently delete your account and all associated data.</div>
            <Button variant="destructive" size="sm">Delete account</Button>
          </div>
        </div>
      )}
    </>
  );
}
