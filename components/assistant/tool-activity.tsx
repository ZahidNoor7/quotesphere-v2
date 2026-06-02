"use client";
import { Loader2, Check, X } from "lucide-react";
import { T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import type { AssistantUiToolEvent } from "@/types";

export function ToolActivity({ events }: { events: AssistantUiToolEvent[] }) {
  if (!events.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
      {events.map((e) => (
        <div
          key={e.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            background: GLASS,
            border: `0.5px solid ${GLASS_BORDER}`,
            borderRadius: 8,
            padding: "5px 10px",
          }}
        >
          <span style={{ display: "flex", flexShrink: 0 }}>
            {e.status === "running" ? (
              <Loader2 size={12} className="animate-spin" color={T3} />
            ) : e.status === "error" ? (
              <X size={12} color="#ef4444" />
            ) : (
              <Check size={12} color="#22c55e" />
            )}
          </span>
          <span style={{ color: T2 }}>{e.label}</span>
          {e.summary && e.status !== "running" && (
            <span style={{ color: T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              · {e.summary}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
