"use client";
import Link from "next/link";
import { ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { T1, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import type { AssistantUiMessage } from "@/types";
import { ToolActivity } from "./tool-activity";

function formatStamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

const stampStyle: React.CSSProperties = { fontSize: 10, color: T3, marginTop: 3 };

export function AssistantMessageBubble({ msg }: { msg: AssistantUiMessage }) {
  const stamp = formatStamp(msg.createdAt);

  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 12 }}>
        <div
          style={{
            maxWidth: "78%",
            padding: "9px 13px",
            borderRadius: "16px 16px 4px 16px",
            background: AC,
            color: "#fff",
            fontSize: 13.5,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.content}
        </div>
        {stamp && <div style={{ ...stampStyle, marginRight: 2 }}>{stamp}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `color-mix(in srgb, ${AC} 16%, transparent)`,
          border: `0.5px solid color-mix(in srgb, ${AC} 30%, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: AC,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Sparkles size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.toolEvents && <ToolActivity events={msg.toolEvents} />}
        {msg.content && (
          <div style={{ fontSize: 13.5, color: T1, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {msg.content}
          </div>
        )}
        {msg.error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12.5, color: "#ef4444" }}>
            <AlertCircle size={13} /> {msg.error}
          </div>
        )}
        {msg.documentLink && (
          <Link
            href={msg.documentLink}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 8,
              background: GLASS,
              border: `0.5px solid ${GLASS_BORDER}`,
              color: AC,
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View {msg.documentLabel ?? "document"} <ArrowRight size={13} />
          </Link>
        )}
        {stamp && <div style={stampStyle}>{stamp}</div>}
      </div>
    </div>
  );
}
