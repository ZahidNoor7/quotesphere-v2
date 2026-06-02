"use client";
import Link from "next/link";
import { ArrowRight, AlertCircle, Sparkles, Pencil, RotateCcw } from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import type { AssistantUiMessage } from "@/types";
import { ToolActivity } from "./tool-activity";
import { DocumentCard } from "./document-card";

function formatStamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

const stampStyle: React.CSSProperties = { fontSize: 10, color: T3, marginTop: 3 };

export function AssistantMessageBubble({
  msg,
  onEdit,
  onRetry,
}: {
  msg: AssistantUiMessage;
  onEdit?: () => void;
  onRetry?: () => void;
}) {
  const stamp = formatStamp(msg.createdAt);

  if (msg.role === "user") {
    return (
      <div className="group/msg" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 12, gap: 6 }}>
        {msg.attachments?.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "82%" }}>
            {msg.attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="attachment" style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, display: "block" }} />
              </a>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "82%" }}>
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit & resend"
              className="opacity-0 group-hover/msg:opacity-100"
              style={{ background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", padding: 4, transition: "opacity 0.15s", flexShrink: 0 }}
            >
              <Pencil size={13} />
            </button>
          )}
          {msg.content ? (
            <div
              style={{
                padding: "9px 13px",
                borderRadius: "16px 16px 4px 16px",
                background: AC,
                color: "#fff",
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minWidth: 0,
              }}
            >
              {msg.content}
            </div>
          ) : null}
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
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#ef4444" }}>
              <AlertCircle size={13} /> {msg.error}
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
              >
                <RotateCcw size={12} /> Retry
              </button>
            )}
          </div>
        )}
        {msg.documentCard ? (
          <DocumentCard card={msg.documentCard} />
        ) : msg.documentLink ? (
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
        ) : null}
        {stamp && <div style={stampStyle}>{stamp}</div>}
      </div>
    </div>
  );
}
