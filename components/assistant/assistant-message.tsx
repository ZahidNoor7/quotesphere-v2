"use client";
import Link from "next/link";
import { ArrowRight, AlertCircle, Sparkles, Pencil, RotateCcw } from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import type { AssistantUiMessage } from "@/types";
import { ToolActivity } from "./tool-activity";
import { DocumentCard } from "./document-card";
import { MarkdownMessage } from "./markdown-message";

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
  onSuggestion,
}: {
  msg: AssistantUiMessage;
  onEdit?: () => void;
  onRetry?: () => void;
  onSuggestion?: (text: string) => void;
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
              dir="auto"
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
      {/* Shrink-to-fit, capped & left-anchored so RTL replies stay on the left (not the far-right edge like user messages). */}
      <div style={{ flex: "0 1 auto", minWidth: 0, maxWidth: "82%", marginRight: "auto" }}>
        {msg.toolEvents && <ToolActivity events={msg.toolEvents} />}
        {msg.content && <MarkdownMessage content={msg.content} />}
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
        {msg.suggestions?.length && onSuggestion ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
            {msg.suggestions.map((s, i) => (
              <button
                key={i}
                dir="auto"
                onClick={() => onSuggestion(s)}
                style={{ padding: "5px 12px", borderRadius: 999, background: `color-mix(in srgb, ${AC} 12%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 30%, transparent)`, color: AC, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {(stamp || (onRetry && !msg.error)) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            {stamp && <div style={{ ...stampStyle, marginTop: 0 }}>{stamp}</div>}
            {onRetry && !msg.error && (
              <button
                onClick={onRetry}
                title="Regenerate this reply"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", color: T3, fontSize: 11, fontWeight: 500 }}
              >
                <RotateCcw size={11} /> Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
