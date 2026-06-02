"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import type { ReminderSettings } from "@/types";

const DEFAULTS: ReminderSettings = {
  enabled: false,
  channels: { email: true, whatsapp: false },
  dueSoonDays: 3,
  overdueDays: [1, 7, 14],
};

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 500, color: T3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" };
const input: React.CSSProperties = { width: "100%", padding: "8px 12px", background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 9, fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

export default function RemindersSettingsPage() {
  const { settings, mutate } = useSettings();
  const [cfg, setCfg] = useState<ReminderSettings>(DEFAULTS);
  const [overdueText, setOverdueText] = useState("1, 7, 14");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.reminders) {
      const r: ReminderSettings = {
        ...DEFAULTS,
        ...settings.reminders,
        channels: { ...DEFAULTS.channels, ...settings.reminders.channels },
      };
      setCfg(r);
      setOverdueText((r.overdueDays ?? []).join(", "));
    }
  }, [settings?.reminders]);

  const setChannel = (k: "email" | "whatsapp", v: boolean) =>
    setCfg((p) => ({ ...p, channels: { ...p.channels, [k]: v } }));

  async function save() {
    setSaving(true);
    const overdueDays = overdueText
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const payload: ReminderSettings = { ...cfg, dueSoonDays: Math.max(0, cfg.dueSoonDays || 0), overdueDays };
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminders: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      await mutate();
      toast.success("Reminder settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Payment reminders</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 3, lineHeight: 1.5 }}>
          Automatically remind clients about invoices that are due soon or overdue. Runs once a day.
        </div>
      </div>

      <div style={{ borderRadius: 12, border: `0.5px solid ${cfg.enabled ? `color-mix(in srgb,${AC} 35%,var(--glass-border))` : GLASS_BORDER}`, background: GLASS, overflow: "hidden", transition: "border-color 0.2s" }}>
        {/* Header / enable */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: cfg.enabled ? `0.5px solid ${GLASS_BORDER}` : "none" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `color-mix(in srgb,${AC} 14%,transparent)`, border: `0.5px solid color-mix(in srgb,${AC} 30%,transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: AC }}>
            <Bell size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Automatic reminders</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>Send via email and/or WhatsApp on a daily schedule.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Label htmlFor="toggle-reminders" style={{ fontSize: 11, color: cfg.enabled ? T2 : T3 }}>{cfg.enabled ? "On" : "Off"}</Label>
            <Switch id="toggle-reminders" checked={cfg.enabled} onCheckedChange={(v) => setCfg((p) => ({ ...p, enabled: v }))} />
          </div>
        </div>

        {cfg.enabled && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Channels */}
            <div>
              <label style={lbl}>Channels</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([
                  ["email", "Email", "Sent to the client's email (needs an email on the customer)"],
                  ["whatsapp", "WhatsApp", "Sent to the invoice phone via your 360dialog connection"],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: T1 }}>{label}</div>
                      <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{hint}</div>
                    </div>
                    <Switch checked={cfg.channels[key]} onCheckedChange={(v) => setChannel(key, v)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Remind before due (days)</label>
                <input type="number" min={0} value={cfg.dueSoonDays} onChange={(e) => setCfg((p) => ({ ...p, dueSoonDays: parseInt(e.target.value, 10) || 0 }))} style={input} />
              </div>
              <div>
                <label style={lbl}>Overdue reminders (days)</label>
                <input value={overdueText} onChange={(e) => setOverdueText(e.target.value)} placeholder="1, 7, 14" style={input} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: T3, lineHeight: 1.5 }}>
              Example: a client is reminded {cfg.dueSoonDays} day(s) before the due date, then on each overdue day above — at most one message per invoice per day.
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, background: AC, border: "none", color: "#fff", fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          <Save size={14} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
