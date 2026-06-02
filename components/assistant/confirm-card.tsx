"use client";
import { ShieldCheck, Check, X } from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import type { AssistantPendingAction } from "@/types";

export function ConfirmCard({
  action,
  onConfirm,
  onCancel,
  busy,
}: {
  action: AssistantPendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
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
          <ShieldCheck size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{action.title}</div>
          <div style={{ fontSize: 11.5, color: T3, marginTop: 1 }}>{action.summary}</div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {action.preview.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 12, fontSize: 12.5 }}>
            <div style={{ width: 110, flexShrink: 0, color: T3 }}>{row.label}</div>
            <div style={{ color: T1, whiteSpace: "pre-wrap", flex: 1, minWidth: 0 }}>{row.value}</div>
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
          onClick={onConfirm}
          disabled={busy}
          style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: busy ? `color-mix(in srgb, ${AC} 55%, transparent)` : AC, border: "none", color: "#fff", cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Check size={13} /> {busy ? "Working…" : "Confirm & save"}
        </button>
      </div>
    </div>
  );
}
