"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles, Send, Plus, Trash2, ArrowRight, Loader2, Square, MessageSquarePlus,
} from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useAssistantConversations } from "@/hooks/use-assistant-conversations";
import { AssistantMessageBubble } from "@/components/assistant/assistant-message";
import { ConfirmCard } from "@/components/assistant/confirm-card";
import { FormCard } from "@/components/assistant/form-card";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const SUGGESTIONS = [
  "Create a quotation for …",
  "Make an invoice for 2 × website design at 50,000",
  "Convert quotation QT-00001 to an invoice",
  "Record a 10,000 cash payment on invoice INV-00007",
];

// ─── Not-configured empty state ───────────────────────────────────────────────

function NotConfigured() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: `color-mix(in srgb, ${AC} 14%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 30%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sparkles size={32} color={AC} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T1, marginBottom: 8 }}>AI Assistant not configured</div>
        <div style={{ fontSize: 13, color: T3, maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
          Connect an LLM provider (OpenAI, Azure OpenAI or Anthropic) to create and edit quotations and invoices just by chatting.
        </div>
        <Link
          href="/settings/integrations"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, background: `color-mix(in srgb, ${AC} 16%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 40%, transparent)`, color: AC, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          Configure AI Assistant <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", color: T3 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `color-mix(in srgb, ${AC} 16%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 30%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: AC, flexShrink: 0 }}>
        <Sparkles size={14} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
        <Loader2 size={13} className="animate-spin" /> Thinking…
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const { conversations, mutate: mutateConversations } = useAssistantConversations();

  const onConversationChange = useCallback(() => {
    void mutateConversations();
  }, [mutateConversations]);

  const chat = useAssistantStream(onConversationChange);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isConfigured = !!settings?.integrations?.aiAssistant?.enabled;

  // Auto-scroll to bottom as the thread / stream grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.streamingText, chat.toolEvents, chat.pendingAction]);

  function submit() {
    const value = text.trim();
    if (!value || chat.isStreaming) return;
    setText("");
    void chat.send(value);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (id === chat.conversationId) chat.newChat();
      void mutateConversations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (settingsLoading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: T3 }}>Loading…</div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>AI Assistant</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Create quotations & invoices by chatting</div>
        </div>
        <NotConfigured />
      </div>
    );
  }

  const showThread = chat.messages.length > 0 || chat.isStreaming || !!chat.pendingAction;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Left: conversation list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `0.5px solid ${GLASS_BORDER}`, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
          <button
            onClick={() => chat.newChat()}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: `color-mix(in srgb, ${AC} 14%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 34%, transparent)`, color: AC, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={15} /> New chat
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {conversations.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: T3 }}>No conversations yet.</div>
          )}
          {conversations.map((c) => {
            const active = c._id === chat.conversationId;
            return (
              <div
                key={c._id}
                onClick={() => chat.loadConversation(c._id)}
                style={{ padding: "11px 14px", display: "flex", gap: 10, alignItems: "center", cursor: "pointer", borderLeft: active ? `2px solid ${AC}` : "2px solid transparent", background: active ? `color-mix(in srgb, ${AC} 8%, transparent)` : "transparent" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: active ? AC : T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>{timeAgo(c.updatedAt)}</div>
                </div>
                <button
                  onClick={(e) => deleteConversation(c._id, e)}
                  title="Delete"
                  style={{ background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", flexShrink: 0, padding: 4 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: GLASS }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${AC} 16%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 30%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: AC }}>
            <Sparkles size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>AI Assistant</div>
            <div style={{ fontSize: 11, color: T3 }}>Creates & edits quotations and invoices through the app</div>
          </div>
        </div>

        {/* Thread */}
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 20px" }}>
          {!showThread ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `color-mix(in srgb, ${AC} 14%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 28%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: AC }}>
                <MessageSquarePlus size={26} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginBottom: 6 }}>How can I help?</div>
                <div style={{ fontSize: 12.5, color: T3, maxWidth: 380, lineHeight: 1.6 }}>
                  Describe a quotation or invoice in plain English. I&apos;ll prepare it and show you a confirmation before saving anything.
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 460 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setText(s)}
                    style={{ padding: "7px 12px", borderRadius: 999, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 12, cursor: "pointer" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {chat.messages.map((m) => (
                <AssistantMessageBubble key={m.id} msg={m} />
              ))}
              {chat.isStreaming && (chat.streamingText || chat.toolEvents.length > 0) && (
                <AssistantMessageBubble
                  msg={{ id: "live", role: "assistant", content: chat.streamingText, toolEvents: chat.toolEvents.length ? chat.toolEvents : undefined }}
                />
              )}
              {chat.isStreaming && !chat.streamingText && chat.toolEvents.length === 0 && <ThinkingRow />}
              {chat.pendingAction &&
                (chat.pendingAction.form ? (
                  <FormCard
                    action={chat.pendingAction}
                    onSubmit={(values) => chat.confirm(values)}
                    onCancel={() => chat.cancel()}
                    busy={chat.isStreaming}
                  />
                ) : (
                  <ConfirmCard
                    action={chat.pendingAction}
                    onConfirm={() => chat.confirm()}
                    onCancel={() => chat.cancel()}
                    busy={chat.isStreaming}
                  />
                ))}
            </>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0, background: GLASS }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={chat.pendingAction ? "Confirm or cancel the action above, or type a new instruction…" : "Message the assistant… (Enter to send, Shift+Enter for new line)"}
            rows={1}
            disabled={chat.isStreaming}
            style={{ flex: 1, resize: "none", background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 140, overflowY: "auto", opacity: chat.isStreaming ? 0.6 : 1 }}
          />
          {chat.isStreaming ? (
            <button
              onClick={() => chat.stop()}
              title="Stop"
              style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T2 }}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!text.trim()}
              style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: text.trim() ? AC : GLASS, border: `0.5px solid ${text.trim() ? AC : GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: text.trim() ? "pointer" : "default", color: text.trim() ? "#fff" : T3, transition: "all 0.15s" }}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
