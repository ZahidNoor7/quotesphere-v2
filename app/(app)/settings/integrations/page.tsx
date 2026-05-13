"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import type { IntegrationConfig } from "@/types";
import { Cloud, ShieldCheck, DollarSign, Database, Eye, EyeOff, Save } from "lucide-react";

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

export default function IntegrationsPage() {
  const { settings, mutate } = useSettings();
  const [configs, setConfigs] = useState<Record<IntKey, IntegrationConfig>>({
    cloudinary: { enabled: false },
    googleAuth: { enabled: false },
    currencyApi: { enabled: false, provider: "exchangerate-api.com" },
    mongodb: { enabled: false },
  });
  const [saving, setSaving] = useState<IntKey | null>(null);

  useEffect(() => {
    if (settings?.integrations) {
      setConfigs(prev => {
        const next = { ...prev };
        (Object.keys(settings.integrations!) as IntKey[]).forEach(k => {
          next[k] = { ...prev[k], ...(settings.integrations![k] ?? {}) };
        });
        return next;
      });
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
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(null);
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
                        value={(cfg as any)[field.key] ?? ""}
                        onChange={v => updateField(svc.key, field.key, v)}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <Input
                        value={(cfg as any)[field.key] ?? ""}
                        onChange={e => updateField(svc.key, field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <Button
                    size="sm"
                    loading={saving === svc.key}
                    onClick={() => saveService(svc.key)}
                  >
                    <Save size={12} className="mr-1.5" />Save {svc.label}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
