"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import type { IntegrationConfig, WhatsAppConfig, AiAssistantConfig, EmailConfig } from "@/types";
import {
  Cloud, ShieldCheck, DollarSign, Database, Mail, Send,
  Eye, EyeOff, Save, MessageCircle, Zap, Link2, Sparkles,
} from "lucide-react";

type IntKey = "cloudinary" | "googleAuth" | "currencyApi" | "mongodb";

interface ServiceDef {
  key: IntKey;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fields: { key: keyof IntegrationConfig; label: string; placeholder: string; secret?: boolean }[];
  docsUrl?: string;
}

const SERVICES: ServiceDef[] = [
  {
    key: "cloudinary",
    label: "Cloudinary",
    description: "Image & file hosting for company logo, product images, and document attachments.",
    icon: Cloud,
    color: "#3448c5",
    fields: [
      { key: "cloudName", label: "Cloud name", placeholder: "my-cloud" },
      { key: "apiKey", label: "API key", placeholder: "123456789012345" },
      { key: "apiSecret", label: "API secret", placeholder: "xxxxxxxxxxxxxxxxxx", secret: true },
    ],
  },
  {
    key: "googleAuth",
    label: "Google OAuth",
    description: "Allow users to sign in with their Google account.",
    icon: ShieldCheck,
    color: "#ea4335",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client secret", placeholder: "GOCSPX-xxxxxxxxxx", secret: true },
    ],
  },
  {
    key: "currencyApi",
    label: "Currency exchange API",
    description: "Fetch live exchange rates for multi-currency invoices and quotations.",
    icon: DollarSign,
    color: "#16a34a",
    fields: [
      { key: "provider", label: "Provider", placeholder: "exchangerate-api.com" },
      { key: "apiKey", label: "API key", placeholder: "your-api-key-here", secret: true },
    ],
  },
  {
    key: "mongodb",
    label: "MongoDB",
    description: "Custom database connection URI (overrides the default MONGO_URI env variable).",
    icon: Database,
    color: "#47a248",
    fields: [
      { key: "uri", label: "Connection URI", placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/db", secret: true },
    ],
  },
];

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingRight: 36 }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, padding: 0 }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── Email Card ───────────────────────────────────────────────────────────────

const EMAIL_COLOR = "#e11d48";

function EmailCard({ initialCfg, onSaved }: { initialCfg: EmailConfig; onSaved: () => void }) {
  const [cfg, setCfg] = useState<EmailConfig>(initialCfg);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => { setCfg(initialCfg); }, [initialCfg]);

  const set = (patch: Partial<EmailConfig>) => setCfg(prev => ({ ...prev, ...patch }));
  const provider = cfg.provider ?? "resend";
  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { email: cfg } }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Email settings saved.");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testTo.trim()) { toast.error("Enter a recipient email."); return; }
    setTesting(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim(), config: cfg }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Test email sent to ${testTo.trim()} — check the inbox.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={{ borderRadius: 12, border: `0.5px solid ${cfg.enabled ? `color-mix(in srgb,${EMAIL_COLOR} 35%,var(--glass-border))` : GLASS_BORDER}`, background: GLASS, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: cfg.enabled ? `0.5px solid ${GLASS_BORDER}` : "none" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${EMAIL_COLOR}18`, border: `0.5px solid ${EMAIL_COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: EMAIL_COLOR }}>
          <Mail size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Email</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>Send invoices, quotations, receipts and payment reminders by email.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Label htmlFor="toggle-email" style={{ fontSize: 11, color: cfg.enabled ? T2 : T3 }}>{cfg.enabled ? "Enabled" : "Disabled"}</Label>
          <Switch id="toggle-email" checked={cfg.enabled} onCheckedChange={v => set({ enabled: v })} />
        </div>
      </div>

      {cfg.enabled && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Provider — only one active at a time */}
          <div>
            <label style={lbl}>Provider</label>
            <div style={{ display: "flex", gap: 8 }}>
              {([["resend", "Resend (API)"], ["smtp", "SMTP / Gmail"]] as const).map(([p, label]) => (
                <button key={p} type="button" onClick={() => set({ provider: p })}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `0.5px solid ${provider === p ? EMAIL_COLOR : GLASS_BORDER}`, background: provider === p ? `${EMAIL_COLOR}18` : "transparent", color: provider === p ? EMAIL_COLOR : T3, fontSize: 12, fontWeight: provider === p ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {provider === "resend" ? (
            <div>
              <label style={lbl}>Resend API key</label>
              <SecretInput value={cfg.apiKey ?? ""} onChange={v => set({ apiKey: v })} placeholder="re_xxxxxxxxxxxxxxxx" />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>SMTP host</label>
                  <Input value={cfg.smtpHost ?? ""} onChange={e => set({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label style={lbl}>Port</label>
                  <Input value={cfg.smtpPort != null ? String(cfg.smtpPort) : ""} onChange={e => set({ smtpPort: parseInt(e.target.value, 10) || undefined })} placeholder="465" />
                </div>
              </div>
              <div>
                <label style={lbl}>Username (your email)</label>
                <Input value={cfg.smtpUser ?? ""} onChange={e => set({ smtpUser: e.target.value })} placeholder="you@gmail.com" />
              </div>
              <div>
                <label style={lbl}>Password (Gmail: an App Password)</label>
                <SecretInput value={cfg.smtpPassword ?? ""} onChange={v => set({ smtpPassword: v })} placeholder="16-character app password" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Switch id="smtp-secure" checked={cfg.smtpSecure ?? true} onCheckedChange={v => set({ smtpSecure: v })} />
                <Label htmlFor="smtp-secure" style={{ fontSize: 12, color: T2 }}>Use SSL (port 465) — turn off for STARTTLS (587)</Label>
              </div>
              <div style={{ fontSize: 11, color: T3, lineHeight: 1.5 }}>
                Gmail: enable 2-Step Verification, then create an App Password (Google Account → Security → App passwords). Limit ≈ 500 emails/day.
              </div>
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>From name</label>
              <Input value={cfg.fromName ?? ""} onChange={e => set({ fromName: e.target.value })} placeholder="Your Company" />
            </div>
            <div>
              <label style={lbl}>From email</label>
              <Input value={cfg.fromEmail ?? ""} onChange={e => set({ fromEmail: e.target.value })} placeholder={provider === "smtp" ? "you@gmail.com" : "no-reply@yourdomain.com"} />
            </div>
          </div>

          {/* Send a test email using the current (possibly unsaved) settings */}
          <div>
            <label style={lbl}>Send a test email</label>
            <div style={{ display: "flex", gap: 8 }}>
              <Input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@example.com" style={{ flex: 1 }} />
              <Button size="sm" variant="outline" disabled={testing} onClick={sendTest}>
                <Send size={12} className="mr-1.5" />{testing ? "Sending…" : "Send test"}
              </Button>
            </div>
            <div style={{ fontSize: 11, color: T3, marginTop: 5 }}>Uses the settings above — no need to save first.</div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <Button size="sm" disabled={saving} onClick={save}>
              <Save size={12} className="mr-1.5" />{saving ? "Saving…" : "Save Email"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp Card ────────────────────────────────────────────────────────────

const WA_COLOR = "#25d366";

function WhatsAppCard({ initialCfg, onSaved }: { initialCfg: WhatsAppConfig; onSaved: () => void }) {
  const [cfg, setCfg] = useState<WhatsAppConfig>(initialCfg);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [registeredWebhookUrl, setRegisteredWebhookUrl] = useState<string | null>(null);

  useEffect(() => { setCfg(initialCfg); }, [initialCfg]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const baseUrl = cfg.webhookBaseUrl?.replace(/\/$/, "") || origin;
  const webhookUrl = `${baseUrl}/api/webhooks/whatsapp`;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { whatsapp: cfg } }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("WhatsApp settings saved.");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { whatsapp: cfg } }),
      });
      const res = await fetch("/api/whatsapp/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const registered = data.webhookUrl ?? null;
        setRegisteredWebhookUrl(registered);
        if (registered) {
          toast.success(`API key valid. 360dialog has webhook: ${registered}`);
        } else {
          toast.success("API key is valid. No webhook registered with 360dialog yet — click Register Webhook.");
        }
      } else {
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      toast.error("Network error — could not reach 360dialog");
    } finally {
      setTesting(false);
    }
  }

  async function registerWebhook() {
    setSettingWebhook(true);
    try {
      // Save settings first
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { whatsapp: cfg } }),
      });
      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Webhook registered with 360dialog successfully.");
      } else {
        toast.error(data.error ?? "Failed to register webhook");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSettingWebhook(false);
    }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  return (
    <div style={{
      borderRadius: 12,
      border: `0.5px solid ${cfg.enabled ? `color-mix(in srgb,${WA_COLOR} 35%,var(--glass-border))` : GLASS_BORDER}`,
      background: GLASS,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: cfg.enabled ? `0.5px solid ${GLASS_BORDER}` : "none" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${WA_COLOR}18`, border: `0.5px solid ${WA_COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: WA_COLOR }}>
          <MessageCircle size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>WhatsApp (360dialog)</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>
            Send invoices, quotations, and chat with clients directly via WhatsApp Business API.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Label htmlFor="toggle-whatsapp" style={{ fontSize: 11, color: cfg.enabled ? T2 : T3 }}>
            {cfg.enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="toggle-whatsapp"
            checked={cfg.enabled}
            onCheckedChange={v => setCfg(prev => ({ ...prev, enabled: v }))}
          />
        </div>
      </div>

      {/* Fields */}
      {cfg.enabled && (
        <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Mode toggle */}
          <div>
            <label style={lbl}>Mode</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["sandbox", "production"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCfg(prev => ({ ...prev, mode: m }))}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 8,
                    border: `0.5px solid ${cfg.mode === m ? WA_COLOR : GLASS_BORDER}`,
                    background: cfg.mode === m ? `${WA_COLOR}18` : "transparent",
                    color: cfg.mode === m ? WA_COLOR : T3,
                    fontSize: 12,
                    fontWeight: cfg.mode === m ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textTransform: "capitalize",
                  }}
                >
                  {m === "sandbox" ? "Sandbox (test)" : "Production (live)"}
                </button>
              ))}
            </div>
            {cfg.mode === "sandbox" && (
              <div style={{ fontSize: 11, color: T3, marginTop: 6, lineHeight: 1.5 }}>
                Sandbox sends only to your registered test number. Get an API key by messaging{" "}
                <span style={{ color: WA_COLOR, fontWeight: 500 }}>+55 11 4673-3492</span> with <code>START</code>.
              </div>
            )}
          </div>

          {/* API Key */}
          <div>
            <label style={lbl}>API key (D360-API-KEY)</label>
            <div style={{ position: "relative" }}>
              <Input
                type={showKey ? "text" : "password"}
                value={cfg.apiKey ?? ""}
                onChange={e => setCfg(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="your-360dialog-api-key"
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, padding: 0 }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Phone number */}
          <div>
            <label style={lbl}>Business phone number</label>
            <Input
              value={cfg.phoneNumber ?? ""}
              onChange={e => setCfg(prev => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="e.g. 923001234567"
            />
            <div style={{ fontSize: 11, color: T3, marginTop: 5, lineHeight: 1.6 }}>
              International format — country code + number, <strong>no + or spaces</strong>.<br />
              <span style={{ color: WA_COLOR, fontWeight: 500 }}>Pakistan example:</span>{" "}
              <code style={{ background: "rgba(37,211,102,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
                0300 123 4567
              </code>{" "}
              → remove leading <code>0</code>, add country code <code>92</code> →{" "}
              <code style={{ background: "rgba(37,211,102,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                923001234567
              </code>
            </div>
          </div>

          {/* Webhook base URL */}
          <div>
            <label style={lbl}>Webhook base URL</label>
            <Input
              value={cfg.webhookBaseUrl ?? ""}
              onChange={e => setCfg(prev => ({ ...prev, webhookBaseUrl: e.target.value }))}
              placeholder={`${origin} (defaults to this app's origin)`}
            />
            <div style={{ fontSize: 11, color: T3, marginTop: 5, lineHeight: 1.6 }}>
              Set this to your <strong>ngrok</strong> or tunnel URL when testing locally.<br />
              <span style={{ color: WA_COLOR, fontWeight: 500 }}>Example:</span>{" "}
              <code style={{ background: "rgba(37,211,102,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
                https://abc123.ngrok.io
              </code>
            </div>
            {/* Computed full URL (read-only) */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12,
                background: "rgba(37,211,102,0.06)", border: `0.5px solid rgba(37,211,102,0.25)`,
                color: T2, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                <span style={{ color: T3 }}>Full URL → </span>
                <span style={{ color: WA_COLOR, fontWeight: 600 }}>{webhookUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                style={{ flexShrink: 0, padding: "0 10px", height: 36, borderRadius: 8, border: `0.5px solid ${GLASS_BORDER}`, background: "transparent", color: T2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <Link2 size={12} /> Copy
              </button>
            </div>
          </div>

          {/* 360dialog webhook status */}
          {registeredWebhookUrl !== null && (
            <div style={{
              padding: "9px 12px", borderRadius: 9, fontSize: 11, lineHeight: 1.6,
              background: registeredWebhookUrl === webhookUrl
                ? "rgba(37,211,102,0.08)" : "rgba(251,191,36,0.08)",
              border: `0.5px solid ${registeredWebhookUrl === webhookUrl
                ? "rgba(37,211,102,0.3)" : "rgba(251,191,36,0.3)"}`,
            }}>
              {registeredWebhookUrl === webhookUrl ? (
                <span style={{ color: WA_COLOR }}>
                  ✓ 360dialog is sending messages to your webhook URL
                </span>
              ) : (
                <span style={{ color: "#f59e0b" }}>
                  ⚠ 360dialog has a different URL registered:{" "}
                  <code style={{ wordBreak: "break-all" }}>{registeredWebhookUrl || "(none)"}</code>
                  {" "}— click <strong>Register Webhook</strong> to update it.
                </span>
              )}
            </div>
          )}

          {/* Actions row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            <Button
              size="sm"
              variant="outline"
              onClick={testConnection}
              disabled={testing || !cfg.apiKey}
            >
              <Zap size={12} className="mr-1.5" />
              {testing ? "Testing…" : "Test Connection"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={registerWebhook}
              disabled={settingWebhook || !cfg.apiKey}
            >
              <Link2 size={12} className="mr-1.5" />
              {settingWebhook ? "Registering…" : "Register Webhook"}
            </Button>
            <div style={{ flex: 1 }} />
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
            >
              <Save size={12} className="mr-1.5" />
              {saving ? "Saving…" : "Save WhatsApp"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Assistant Card ────────────────────────────────────────────────────────

const AI_COLOR = "#8b5cf6";

const AI_PROVIDERS: { key: AiAssistantConfig["provider"]; label: string; envHint: string }[] = [
  { key: "openai", label: "OpenAI", envHint: "OPENAI_API_KEY" },
  { key: "azure_openai", label: "Azure OpenAI", envHint: "AZURE_OPENAI_API_KEY" },
  { key: "anthropic", label: "Anthropic", envHint: "ANTHROPIC_API_KEY" },
];

function AiAssistantCard({ initialCfg, onSaved }: { initialCfg: AiAssistantConfig; onSaved: () => void }) {
  const [cfg, setCfg] = useState<AiAssistantConfig>(initialCfg);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { setCfg(initialCfg); }, [initialCfg]);

  const set = (patch: Partial<AiAssistantConfig>) => setCfg(prev => ({ ...prev, ...patch }));
  const isAzure = cfg.provider === "azure_openai";
  const isAnthropic = cfg.provider === "anthropic";
  const envHint = AI_PROVIDERS.find(p => p.key === cfg.provider)?.envHint ?? "OPENAI_API_KEY";

  async function saveCfg() {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrations: { aiAssistant: cfg } }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
  }

  async function save() {
    setSaving(true);
    try {
      await saveCfg();
      toast.success("AI Assistant settings saved.");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      await saveCfg(); // test the latest config
      const res = await fetch("/api/assistant/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message ?? "Connection successful.");
        onSaved();
      } else {
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTesting(false);
    }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  return (
    <div style={{
      borderRadius: 12,
      border: `0.5px solid ${cfg.enabled ? `color-mix(in srgb,${AI_COLOR} 35%,var(--glass-border))` : GLASS_BORDER}`,
      background: GLASS,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: cfg.enabled ? `0.5px solid ${GLASS_BORDER}` : "none" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${AI_COLOR}18`, border: `0.5px solid ${AI_COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: AI_COLOR }}>
          <Sparkles size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>
            Create and edit quotations & invoices by chatting. Choose your LLM provider and model.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Label htmlFor="toggle-aiAssistant" style={{ fontSize: 11, color: cfg.enabled ? T2 : T3 }}>
            {cfg.enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id="toggle-aiAssistant"
            checked={cfg.enabled}
            onCheckedChange={v => set({ enabled: v })}
          />
        </div>
      </div>

      {/* Fields */}
      {cfg.enabled && (
        <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Provider selector */}
          <div>
            <label style={lbl}>Provider</label>
            <div style={{ display: "flex", gap: 8 }}>
              {AI_PROVIDERS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => set({ provider: p.key })}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8,
                    border: `0.5px solid ${cfg.provider === p.key ? AI_COLOR : GLASS_BORDER}`,
                    background: cfg.provider === p.key ? `${AI_COLOR}18` : "transparent",
                    color: cfg.provider === p.key ? AI_COLOR : T3,
                    fontSize: 12, fontWeight: cfg.provider === p.key ? 600 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API style (OpenAI / Azure only) */}
          {!isAnthropic && (
            <div>
              <label style={lbl}>API</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([["responses", "Responses API"], ["chat", "Chat Completions"]] as const).map(([key, label]) => {
                  const active = (cfg.apiStyle ?? "responses") === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set({ apiStyle: key })}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: `0.5px solid ${active ? AI_COLOR : GLASS_BORDER}`, background: active ? `${AI_COLOR}18` : "transparent", color: active ? AI_COLOR : T3, fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: T3, marginTop: 5, lineHeight: 1.5 }}>
                gpt-5 models and newer Azure endpoints (<code style={{ background: `${AI_COLOR}14`, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>/openai/responses</code>) require the Responses API.
              </div>
            </div>
          )}

          {/* API key */}
          <div>
            <label style={lbl}>API key</label>
            <div style={{ position: "relative" }}>
              <Input
                type={showKey ? "text" : "password"}
                value={cfg.apiKey ?? ""}
                onChange={e => set({ apiKey: e.target.value })}
                placeholder={isAnthropic ? "sk-ant-…" : isAzure ? "Azure OpenAI key" : "sk-…"}
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, padding: 0 }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: T3, marginTop: 5, lineHeight: 1.5 }}>
              Leave blank to use the <code style={{ background: `${AI_COLOR}14`, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>{envHint}</code> environment variable instead.
            </div>
          </div>

          {/* Provider-specific fields */}
          {isAzure ? (
            <>
              <div>
                <label style={lbl}>Azure endpoint</label>
                <Input
                  value={cfg.azureEndpoint ?? ""}
                  onChange={e => set({ azureEndpoint: e.target.value })}
                  placeholder="https://my-resource.openai.azure.com"
                />
                <div style={{ fontSize: 11, color: T3, marginTop: 5, lineHeight: 1.5 }}>
                  Just the resource origin — pasting the full <code style={{ background: `${AI_COLOR}14`, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>/openai/responses?…</code> URL works too; it&apos;s trimmed automatically.
                </div>
              </div>
              <div>
                <label style={lbl}>Deployment name</label>
                <Input
                  value={cfg.azureDeployment ?? ""}
                  onChange={e => set({ azureDeployment: e.target.value })}
                  placeholder="e.g. gpt-5.4"
                />
              </div>
              <div>
                <label style={lbl}>API version</label>
                <Input
                  value={cfg.azureApiVersion ?? ""}
                  onChange={e => set({ azureApiVersion: e.target.value })}
                  placeholder="2025-04-01-preview"
                />
              </div>
            </>
          ) : (
            <div>
              <label style={lbl}>Model</label>
              <Input
                value={cfg.model ?? ""}
                onChange={e => set({ model: e.target.value })}
                placeholder={isAnthropic ? "claude-sonnet-4-6" : "gpt-4o"}
              />
              {!isAnthropic && (
                <>
                  <label style={{ ...lbl, marginTop: 12 }}>Base URL (optional)</label>
                  <Input
                    value={cfg.baseUrl ?? ""}
                    onChange={e => set({ baseUrl: e.target.value })}
                    placeholder="Override for OpenAI-compatible gateways"
                  />
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
              <Zap size={12} className="mr-1.5" />
              {testing ? "Testing…" : "Test Connection"}
            </Button>
            <div style={{ flex: 1 }} />
            <Button size="sm" onClick={save} disabled={saving}>
              <Save size={12} className="mr-1.5" />
              {saving ? "Saving…" : "Save AI Assistant"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { settings, mutate } = useSettings();
  const [configs, setConfigs] = useState<Record<IntKey, IntegrationConfig>>({
    cloudinary: { enabled: false },
    googleAuth: { enabled: false },
    currencyApi: { enabled: false, provider: "exchangerate-api.com" },
    mongodb: { enabled: false },
  });
  const [waCfg, setWaCfg] = useState<WhatsAppConfig>({ enabled: false, mode: "sandbox" });
  const [aiCfg, setAiCfg] = useState<AiAssistantConfig>({ enabled: false, provider: "openai" });
  const [emailCfg, setEmailCfg] = useState<EmailConfig>({ enabled: false, provider: "resend" });
  const [saving, setSaving] = useState<IntKey | null>(null);
  const [testingCloud, setTestingCloud] = useState(false);

  useEffect(() => {
    if (settings?.integrations) {
      setConfigs(prev => {
        const next = { ...prev };
        (Object.keys(settings.integrations!) as IntKey[]).forEach(k => {
          if (k in prev) {
            next[k] = { ...prev[k], ...(settings.integrations![k] ?? {}) };
          }
        });
        return next;
      });
      if (settings.integrations.whatsapp) {
        setWaCfg(settings.integrations.whatsapp as WhatsAppConfig);
      }
      if (settings.integrations.aiAssistant) {
        setAiCfg(settings.integrations.aiAssistant as AiAssistantConfig);
      }
      if (settings.integrations.email) {
        setEmailCfg(settings.integrations.email as EmailConfig);
      }
    }
  }, [settings]);

  function updateField(key: IntKey, field: keyof IntegrationConfig, val: string | boolean) {
    setConfigs(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  }

  async function saveService(key: IntKey) {
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { [key]: configs[key] } }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Integration saved.");
      mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function testCloudinary() {
    const c = configs.cloudinary as { cloudName?: string; apiKey?: string; apiSecret?: string };
    if (!c.cloudName || !c.apiKey || !c.apiSecret) {
      toast.error("Enter cloud name, API key and API secret first.");
      return;
    }
    setTestingCloud(true);
    try {
      const res = await fetch("/api/cloudinary/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudName: c.cloudName, apiKey: c.apiKey, apiSecret: c.apiSecret }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Connection failed");
      toast.success(data.message || "Cloudinary connection successful.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTestingCloud(false);
    }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
      <div style={{ fontSize: 13, color: T3, marginBottom: 4, lineHeight: 1.65 }}>
        Configure third-party services. Toggle each integration on or off and enter the required credentials. Credentials are stored in your settings and override environment variables where supported.
      </div>

      {SERVICES.map(svc => {
        const cfg = configs[svc.key];
        const Icon = svc.icon;
        return (
          <div key={svc.key} style={{ borderRadius: 12, border: `0.5px solid ${cfg.enabled ? `color-mix(in srgb,${svc.color} 35%,var(--glass-border))` : GLASS_BORDER}`, background: GLASS, overflow: "hidden", transition: "border-color 0.2s" }}>
            {/* Header */}
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: cfg.enabled ? `0.5px solid ${GLASS_BORDER}` : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${svc.color}18`, border: `0.5px solid ${svc.color}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: svc.color }}>
                <Icon size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{svc.label}</div>
                <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{svc.description}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Label htmlFor={`toggle-${svc.key}`} style={{ fontSize: 11, color: cfg.enabled ? T2 : T3 }}>
                  {cfg.enabled ? "Enabled" : "Disabled"}
                </Label>
                <Switch
                  id={`toggle-${svc.key}`}
                  checked={cfg.enabled}
                  onCheckedChange={v => updateField(svc.key, "enabled", v)}
                />
              </div>
            </div>

            {/* Fields */}
            {cfg.enabled && (
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {svc.fields.map(field => (
                  <div key={field.key}>
                    <label style={lbl}>{field.label}</label>
                    {field.secret ? (
                      <SecretInput
                        value={(cfg as unknown as Record<string, string>)[field.key as string] ?? ""}
                        onChange={v => updateField(svc.key, field.key, v)}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <Input
                        value={(cfg as unknown as Record<string, string>)[field.key as string] ?? ""}
                        onChange={e => updateField(svc.key, field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                  {svc.key === "cloudinary" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingCloud}
                      onClick={testCloudinary}
                    >
                      <Link2 size={12} className="mr-1.5" />{testingCloud ? "Testing…" : "Test connection"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={saving === svc.key}
                    onClick={() => saveService(svc.key)}
                  >
                    <Save size={12} className="mr-1.5" />{saving === svc.key ? "Saving…" : `Save ${svc.label}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Email card */}
      <EmailCard initialCfg={emailCfg} onSaved={mutate} />

      {/* WhatsApp card */}
      <WhatsAppCard initialCfg={waCfg} onSaved={mutate} />

      {/* AI Assistant card */}
      <AiAssistantCard initialCfg={aiCfg} onSaved={mutate} />
    </div>
  );
}
