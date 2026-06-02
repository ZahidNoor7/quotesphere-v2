"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles, Send, Plus, Trash2, ArrowRight, Loader2, Square, MessageSquarePlus, Pin, Search, ImagePlus, X,
} from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { useAssistantConversations } from "@/hooks/use-assistant-conversations";
import { AssistantMessageBubble } from "@/components/assistant/assistant-message";
import { ConfirmCard } from "@/components/assistant/confirm-card";
import { FormCard } from "@/components/assistant/form-card";
import { MessageSkeleton, ConversationListSkeleton } from "@/components/assistant/skeletons";

interface PendingAttachment {
  id: string;
  url: string;
  preview: string;
  uploading: boolean;
}

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

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { conversations, mutate: mutateConversations, togglePin, isLoading: conversationsLoading } =
    useAssistantConversations(debouncedSearch);

  const onConversationChange = useCallback(() => {
    void mutateConversations();
  }, [mutateConversations]);

  const chat = useAssistantStream(onConversationChange);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 8);
    for (const file of imgs) {
      const id = Math.random().toString(36).slice(2);
      const preview = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { id, url: "", preview, uploading: true }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "quotesphere/assistant");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, url: data.data.url, uploading: false } : a)));
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Image upload failed");
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function startEdit(id: string, content: string) {
    setEditingId(id);
    setEditDraft(content);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }
  function saveEdit() {
    const v = editDraft.trim();
    if (!v) return;
    cancelEdit();
    void chat.editAndResend(v);
  }

  const isConfigured = !!settings?.integrations?.aiAssistant?.enabled;

  // Auto-scroll to bottom as the thread / stream grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.streamingText, chat.toolEvents, chat.pendingAction]);

  function submit() {
    const value = text.trim();
    const urls = attachments.filter((a) => a.url).map((a) => a.url);
    if (chat.isStreaming || attachments.some((a) => a.uploading)) return;
    if (!value && urls.length === 0) return;
    setText("");
    setAttachments([]);
    void chat.send(value || "(see attached image)", urls.length ? urls : undefined);
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
  const lastMsg = chat.messages[chat.messages.length - 1];
  let lastUserId: string | undefined;
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].role === "user") {
      lastUserId = chat.messages[i].id;
      break;
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Left: conversation list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `0.5px solid ${GLASS_BORDER}`, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => chat.newChat()}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: `color-mix(in srgb, ${AC} 14%, transparent)`, border: `0.5px solid color-mix(in srgb, ${AC} 34%, transparent)`, color: AC, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={15} /> New chat
          </button>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T3, pointerEvents: "none" }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search conversations…"
              style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 9, fontSize: 12, color: T1, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {conversationsLoading && conversations.length === 0 ? (
            <ConversationListSkeleton />
          ) : conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: T3 }}>
              {debouncedSearch ? "No matching conversations." : "No conversations yet."}
            </div>
          ) : null}
          {conversations.map((c) => {
            const active = c._id === chat.conversationId;
            return (
              <div
                key={c._id}
                onClick={() => chat.loadConversation(c._id)}
                className="group/conv"
                style={{ padding: "11px 14px", display: "flex", gap: 8, alignItems: "center", cursor: "pointer", borderLeft: active ? `2px solid ${AC}` : "2px solid transparent", background: active ? `color-mix(in srgb, ${AC} 8%, transparent)` : "transparent" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    {c.pinned && <Pin size={11} style={{ color: AC, flexShrink: 0, fill: AC }} />}
                    <span style={{ fontSize: 13, fontWeight: 500, color: active ? AC : T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>{timeAgo(c.updatedAt)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); void togglePin(c._id, !c.pinned); }}
                  title={c.pinned ? "Unpin" : "Pin to top"}
                  className={c.pinned ? "" : "opacity-0 group-hover/conv:opacity-100"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: c.pinned ? AC : T3, display: "flex", flexShrink: 0, padding: 4, transition: "opacity 0.15s" }}
                >
                  <Pin size={13} style={c.pinned ? { fill: AC } : undefined} />
                </button>
                <button
                  onClick={(e) => deleteConversation(c._id, e)}
                  title="Delete"
                  className="opacity-0 group-hover/conv:opacity-100"
                  style={{ background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", flexShrink: 0, padding: 4, transition: "opacity 0.15s" }}
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
          {chat.historyLoading ? (
            <MessageSkeleton />
          ) : !showThread ? (
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
              {chat.messages.map((m) => {
                if (m.id === editingId) {
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 12 }}>
                      <div style={{ width: "82%", maxWidth: 520 }}>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          autoFocus
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit();
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          style={{ width: "100%", resize: "none", background: "var(--glass)", border: `0.5px solid ${AC}`, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, color: T1, outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 160, overflowY: "auto" }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                          <button onClick={cancelEdit} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12.5, background: "transparent", border: `0.5px solid ${GLASS_BORDER}`, color: T2, cursor: "pointer" }}>
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            disabled={!editDraft.trim()}
                            style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: AC, border: "none", color: "#fff", cursor: editDraft.trim() ? "pointer" : "default", opacity: editDraft.trim() ? 1 : 0.6 }}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const canEdit = m.role === "user" && m.id === lastUserId && !chat.isStreaming;
                const canRetry = m.role === "assistant" && !!m.error && m.id === lastMsg?.id && !chat.isStreaming;
                return (
                  <AssistantMessageBubble
                    key={m.id}
                    msg={m}
                    onEdit={canEdit ? () => startEdit(m.id, m.content) : undefined}
                    onRetry={canRetry ? () => chat.retry() : undefined}
                  />
                );
              })}
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
                    onSubmit={(values) => chat.confirm({ formValues: values })}
                    onCancel={() => chat.cancel()}
                    busy={chat.isStreaming}
                  />
                ) : (
                  <ConfirmCard
                    action={chat.pendingAction}
                    onConfirm={(status) => chat.confirm({ status })}
                    onCancel={() => chat.cancel()}
                    busy={chat.isStreaming}
                  />
                ))}
            </>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0, background: GLASS, display: "flex", flexDirection: "column", gap: 8 }}>
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {attachments.map((a) => (
                <div key={a.id} style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url || a.preview} alt="attachment" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `0.5px solid ${GLASS_BORDER}`, opacity: a.uploading ? 0.5 : 1, display: "block" }} />
                  {a.uploading && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Loader2 size={16} className="animate-spin" color="#fff" />
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(a.id)}
                    title="Remove"
                    style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={chat.isStreaming}
              title="Attach image"
              style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: chat.isStreaming ? "default" : "pointer", color: T2, opacity: chat.isStreaming ? 0.5 : 1 }}
            >
              <ImagePlus size={17} />
            </button>
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
              (() => {
                const canSend = !!text.trim() || attachments.some((a) => a.url);
                return (
                  <button
                    onClick={submit}
                    disabled={!canSend}
                    style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: canSend ? AC : GLASS, border: `0.5px solid ${canSend ? AC : GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: canSend ? "pointer" : "default", color: canSend ? "#fff" : T3, transition: "all 0.15s" }}
                  >
                    <Send size={16} />
                  </button>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
