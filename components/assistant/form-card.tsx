"use client";
import { useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import type { AssistantPendingAction } from "@/types";

/** Editable confirmation card — the user completes the fields and confirms (e.g. new customer). */
export function FormCard({
  action,
  onSubmit,
  onCancel,
  busy,
}: {
  action: AssistantPendingAction;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const fields = action.form ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  );
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const missingRequired = fields.some((f) => f.required && !values[f.key]?.trim());

  return (
    <div
      style={{
        border: `0.5px solid color-mix(in srgb, ${AC} 35%, ${GLASS_BORDER})`,
        background: GLASS,
        borderRadius: 14,
        overflow: "hidden",
        maxWidth: 540,
        marginLeft: 38,
        marginBottom: 14,
        boxShadow: "0 4px 24px var(--accent-glow)",
      }}
    >
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${AC} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: AC, flexShrink: 0 }}>
          <UserPlus size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{action.title}</div>
          <div style={{ fontSize: 11.5, color: T3, marginTop: 1 }}>{action.summary}</div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" }}>
              {f.label}
              {f.required && <span style={{ color: "#ef4444" }}> *</span>}
            </label>
            <Input
              type={f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !missingRequired && !busy) onSubmit(values);
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 16px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: `0.5px solid ${GLASS_BORDER}` }}>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, background: "transparent", border: `0.5px solid ${GLASS_BORDER}`, color: T2, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <X size={13} /> Cancel
        </button>
        <button
          onClick={() => onSubmit(values)}
          disabled={busy || missingRequired}
          title={missingRequired ? "Fill in the required fields" : undefined}
          style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: AC, border: "none", color: "#fff", cursor: busy || missingRequired ? "default" : "pointer", opacity: busy || missingRequired ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
        >
          <Check size={13} /> {busy ? "Saving…" : "Create"}
        </button>
      </div>
    </div>
  );
}
