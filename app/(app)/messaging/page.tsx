"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { MessageCircle, Send, Search, ArrowRight, CheckCheck, Check, Phone, Trash2, AlertTriangle, X, AlertCircle, ChevronLeft, Paperclip } from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessagingListSkeleton, MessageThreadSkeleton } from "@/components/messaging/skeletons";
import { MediaBubble } from "@/components/messaging/MediaBubble";
import type { WhatsAppConversation, WhatsAppMessage } from "@/types";
import Link from "next/link";

// WhatsApp-style "blue tick" for read; muted for sent/delivered.
const TICK_READ = "#38bdf8";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 12px" }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: T3, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 100, padding: "3px 12px" }}>
        {label}
      </span>
    </div>
  );
}

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data ?? []);

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteConfirmDialog({
  name, onConfirm, onCancel, loading,
}: { name: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 380, background: GLASS,
        border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 14,
        padding: "20px 20px", backdropFilter: "blur(24px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(239,68,68,0.12)", border: "0.5px solid rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>Delete conversation</div>
            <div style={{ fontSize: 11, color: T3 }}>This cannot be undone</div>
          </div>
          <button onClick={onCancel} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T3, display: "flex" }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: T2, lineHeight: 1.6, marginBottom: 18 }}>
          All messages with <strong style={{ color: T1 }}>{name}</strong> will be permanently deleted from QuoteSphere. This does not affect WhatsApp.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13,
              background: "transparent", border: `0.5px solid ${GLASS_BORDER}`,
              color: T2, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: loading ? "rgba(239,68,68,0.5)" : "#ef4444",
              border: "none", color: "#fff", cursor: loading ? "default" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state when WhatsApp not configured ─────────────────────────────────

function NotConfigured() {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 16, padding: 40, textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "rgba(37,211,102,0.12)", border: "0.5px solid rgba(37,211,102,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <MessageCircle size={32} color="#25d366" />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T1, marginBottom: 8 }}>
          WhatsApp not configured
        </div>
        <div style={{ fontSize: 13, color: T3, maxWidth: 340, lineHeight: 1.6, marginBottom: 20 }}>
          Connect your 360dialog WhatsApp Business account to send and receive messages with clients directly from QuoteSphere.
        </div>
        <Link
          href="/settings/integrations"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 18px", borderRadius: 10,
            background: "rgba(37,211,102,0.15)", border: "0.5px solid rgba(37,211,102,0.4)",
            color: "#25d366", fontSize: 13, fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Configure WhatsApp <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ─── Conversation list item ───────────────────────────────────────────────────

function ConversationItem({
  conv, active, onClick,
}: { conv: WhatsAppConversation; active: boolean; onClick: () => void }) {
  const name = conv.customer_name ?? conv.phone;
  const initial = name.charAt(0).toUpperCase();

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "12px 14px",
        display: "flex", gap: 11, alignItems: "center",
        background: active ? "rgba(37,211,102,0.08)" : "transparent",
        borderTop: "none", borderRight: "none", borderBottom: "none",
        borderLeft: active ? "2px solid #25d366" : "2px solid transparent",
        cursor: "pointer", transition: "background 0.12s",
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
        background: active ? "rgba(37,211,102,0.2)" : GLASS,
        border: `0.5px solid ${active ? "rgba(37,211,102,0.4)" : GLASS_BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: active ? "#25d366" : T2,
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: active ? "#25d366" : T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
            {name}
          </span>
          <span style={{ fontSize: 10, color: T3, flexShrink: 0 }}>
            {timeAgo(conv.lastMessageAt)}
          </span>
        </div>
        <div style={{ fontSize: 12, color: T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {conv.direction === "out" && <span style={{ color: "#25d366", marginRight: 3 }}>You:</span>}
          {conv.lastMessage}
        </div>
      </div>
      {conv.unreadCount > 0 && (
        <div style={{
          width: 18, height: 18, borderRadius: "50%", background: "#25d366",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
        </div>
      )}
    </button>
  );
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

function StatusTicks({ status, isOut }: { status: WhatsAppMessage["status"]; isOut: boolean }) {
  if (!isOut) return null;
  if (status === "failed") return <AlertCircle size={12} color="#ef4444" />;
  const muted = "rgba(255,255,255,0.6)";
  if (status === "sent") return <Check size={12} color={muted} />;
  // delivered = muted double tick; read = blue double tick
  return <CheckCheck size={12} color={status === "read" ? TICK_READ : muted} />;
}

function Bubble({ msg }: { msg: WhatsAppMessage }) {
  const isOut = msg.direction === "out";
  const isFailed = msg.status === "failed";
  const mt = msg.messageType ?? "text";
  const isMedia = mt !== "text" && mt !== "template";
  // For media we store the caption in `body` too; show it under the media.
  const caption = isMedia ? (msg.caption ?? "") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{
        maxWidth: "78%", padding: isMedia ? 5 : "9px 13px",
        borderRadius: isOut ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isFailed ? "rgba(239,68,68,0.08)" : isOut ? AC : GLASS,
        border: `0.5px solid ${isFailed ? "rgba(239,68,68,0.4)" : isOut ? "transparent" : GLASS_BORDER}`,
      }}>
        {isMedia ? (
          <div style={{ display: "flex", flexDirection: "column", gap: caption ? 6 : 0 }}>
            <MediaBubble msg={msg} isOut={isOut} />
            {caption && (
              <div style={{ fontSize: 13, color: isOut ? "#fff" : T1, lineHeight: 1.5, wordBreak: "break-word", padding: "0 6px" }}>
                {caption}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: isFailed ? "#ef4444" : isOut ? "#fff" : T1, lineHeight: 1.5, wordBreak: "break-word" }}>
            {msg.body}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4, paddingRight: isMedia ? 6 : 0, paddingBottom: isMedia ? 2 : 0 }}>
          <span style={{ fontSize: 10, color: isFailed ? "rgba(239,68,68,0.7)" : isOut ? "rgba(255,255,255,0.6)" : T3 }}>
            {formatTime(msg.timestamp)}
          </span>
          <StatusTicks status={msg.status} isOut={isOut} />
        </div>
      </div>
      {/* Error details below bubble */}
      {isFailed && (msg.errorDetails || msg.errorCode) && (
        <div style={{ fontSize: 10, color: "#ef4444", marginTop: 3, maxWidth: "78%", lineHeight: 1.4 }}>
          ⚠ {msg.errorDetails ?? `Error ${msg.errorCode}`}
          {msg.errorCode === "131047" && " — customer must message you first (24-hour window)"}
        </div>
      )}
    </div>
  );
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

async function postStatus(action: "read" | "typing", messageId: string) {
  await fetch("/api/whatsapp/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, messageId }),
  }).catch(() => { /* non-critical */ });
}

function ChatPanel({
  phone, customerName, onDeleted, onReadAll, isMobile, onBack, cloudinaryConfigured,
}: { phone: string; customerName?: string; onDeleted: () => void; onReadAll: () => void; isMobile?: boolean; onBack?: () => void; cloudinaryConfigured: boolean }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; dataUri: string; previewUrl?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef<Set<string>>(new Set());
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const { data: messages = [], mutate, isLoading: messagesLoading } = useSWR<WhatsAppMessage[]>(
    `/api/whatsapp/messages?phone=${encodeURIComponent(phone)}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Batch mark-read: fires when conversation opens or new unread messages arrive
  useEffect(() => {
    const hasUnread = messages.some(m => m.direction === "in" && !m.isRead);
    if (!hasUnread) return;

    // Deduplicate: only mark once per "batch" of unread messages
    const key = messages.filter(m => m.direction === "in" && !m.isRead).map(m => m._id).join(",");
    if (markedReadRef.current.has(key)) return;
    markedReadRef.current.add(key);

    fetch("/api/whatsapp/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    })
      .then(() => {
        mutate();      // refresh messages (isRead now true)
        onReadAll();   // refresh conversation list (unreadCount drops to 0)
      })
      .catch(() => {});
  }, [messages, phone, mutate, onReadAll]);

  // Scroll to bottom by moving the container's scrollTop — never touches window scroll
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleTyping(value: string) {
    setText(value);
    if (!value.trim()) return;

    // Send typing indicator at most once every 20s (bubble lasts 25s per docs)
    const now = Date.now();
    if (now - lastTypingSentRef.current < 20000) return;

    // Get the last inbound message to reference its wamid
    const lastInbound = [...messages].reverse().find(m => m.direction === "in" && m.messageId?.startsWith("wamid."));
    if (!lastInbound) return;

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      lastTypingSentRef.current = Date.now();
      postStatus("typing", lastInbound.messageId);
    }, 400);
  }

  async function send() {
    if (!text.trim() && !attachment) return;
    setSending(true);
    const body = text.trim();
    const att = attachment;
    setText("");
    setAttachment(null);
    // Stop any pending typing debounce when message is actually sent
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    try {
      const payload: Record<string, unknown> = { to: phone };
      if (body) payload.body = body;
      if (att) payload.attachment = { dataUri: att.dataUri, filename: att.file.name, mime: att.file.type || "application/octet-stream" };
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to send");
      mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Send failed");
      setText(body);
      if (att) setAttachment(att);
    } finally {
      setSending(false);
    }
  }

  function openFilePicker() {
    if (!cloudinaryConfigured) {
      toast.error("File hosting isn't set up.", {
        description: "Enable Cloudinary in Settings → Integrations to send photos and files.",
        action: { label: "Configure", onClick: () => { window.location.href = "/settings/integrations"; } },
      });
      return;
    }
    fileInputRef.current?.click();
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("File is too large (max 100MB)."); return; }
    try {
      const dataUri = await readFileAsDataUri(file);
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setAttachment({ file, dataUri, previewUrl });
    } catch {
      toast.error("Couldn't read that file.");
    }
  }

  const canSend = !!text.trim() || !!attachment;

  async function deleteChat() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/whatsapp/conversations?phone=${encodeURIComponent(phone)}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Delete failed");
      toast.success(`Conversation deleted (${d.data?.deleted ?? 0} messages)`);
      setShowDeleteConfirm(false);
      onDeleted();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const displayName = customerName ?? phone;

  return (
    <>
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          name={displayName}
          onConfirm={deleteChat}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleting}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `0.5px solid ${GLASS_BORDER}`,
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          background: GLASS,
        }}>
          {isMobile && onBack && (
            <button
              onClick={onBack}
              aria-label="Back to chats"
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: "transparent", border: `0.5px solid ${GLASS_BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: T2,
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(37,211,102,0.15)", border: "0.5px solid rgba(37,211,102,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#25d366",
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{displayName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T3 }}>
              <Phone size={10} /> {phone}
            </div>
          </div>
          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete conversation"
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "transparent", border: `0.5px solid ${GLASS_BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: T3, transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)";
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = GLASS_BORDER;
              (e.currentTarget as HTMLButtonElement).style.color = T3;
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Messages — ref on the scrollable container, never on a child div */}
        <div ref={messagesContainerRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>
          {messagesLoading && messages.length === 0 ? (
            <MessageThreadSkeleton />
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", color: T3, fontSize: 13, marginTop: 60 }}>
              No messages yet. Send the first one below.
            </div>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showSep = !prev || !sameDay(new Date(prev.timestamp), new Date(msg.timestamp));
              return (
                <Fragment key={msg._id}>
                  {showSep && <DateSeparator label={dayLabel(msg.timestamp)} />}
                  <Bubble msg={msg} />
                </Fragment>
              );
            })
          )}
        </div>

        {/* Input */}
        <div style={{ borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0, background: GLASS }}>
          {/* Attachment preview tray */}
          {attachment && (
            <div style={{ padding: "10px 16px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, maxWidth: 320 }}>
                {attachment.previewUrl ? (
                  <img src={attachment.previewUrl} alt="" style={{ width: 40, height: 40, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 7, flexShrink: 0, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Paperclip size={16} color="#818cf8" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.file.name}</div>
                  <div style={{ fontSize: 10.5, color: T3 }}>{(attachment.file.size / 1024 < 1024 ? `${Math.round(attachment.file.size / 1024)} KB` : `${(attachment.file.size / 1048576).toFixed(1)} MB`)}{text.trim() ? " · with caption" : ""}</div>
                </div>
                <button onClick={() => { if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl); setAttachment(null); }} disabled={sending} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", flexShrink: 0 }}>
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <div style={{ padding: "12px 16px", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <input ref={fileInputRef} type="file" onChange={pickFile} hidden
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" />
            <button
              onClick={openFilePicker}
              disabled={sending}
              title={cloudinaryConfigured ? "Attach a file" : "Configure Cloudinary to attach files"}
              aria-label="Attach a file"
              style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: GLASS, border: `0.5px solid ${GLASS_BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: sending ? "default" : "pointer",
                color: cloudinaryConfigured ? T2 : T3, opacity: cloudinaryConfigured ? 1 : 0.6,
                transition: "all 0.15s",
              }}
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={e => {
                // Desktop: Enter sends. Mobile: Enter is a newline, tap Send to submit.
                if (!isMobile && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={attachment ? "Add a caption…" : isMobile ? "Type a message…" : "Type a message… (Enter to send, Shift+Enter for new line)"}
              rows={1}
              style={{
                flex: 1, minWidth: 0, resize: "none", background: "var(--glass)",
                border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 12,
                padding: isMobile ? "11px 14px" : "10px 14px", fontSize: isMobile ? 16 : 13, color: T1,
                outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                maxHeight: 120, overflowY: "auto",
              }}
            />
            <button
              onClick={send}
              disabled={sending || !canSend}
              style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: canSend ? "#25d366" : GLASS,
                border: `0.5px solid ${canSend ? "#25d366" : GLASS_BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: canSend && !sending ? "pointer" : "default",
                color: canSend ? "#fff" : T3,
                transition: "all 0.15s",
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Empty chat panel ─────────────────────────────────────────────────────────

function NoChatSelected() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T3 }}>
      <MessageCircle size={40} strokeWidth={1} />
      <div style={{ fontSize: 14, fontWeight: 500, color: T2 }}>Select a conversation</div>
      <div style={{ fontSize: 12, color: T3 }}>Choose a contact from the left to start chatting</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagingPage() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Single-pane on mobile / narrow viewports: list ↔ chat (same pattern as the assistant).
  const deviceMobile = useIsMobile();
  const [narrow, setNarrow] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 820);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const isMobile = deviceMobile || narrow;

  const isConfigured = !!(
    settings?.integrations?.whatsapp?.enabled &&
    settings?.integrations?.whatsapp?.apiKey
  );
  const cloudinaryConfigured = !!settings?.cloudinaryConfigured;

  const { data: conversations = [], mutate: mutateConversations, isLoading: conversationsLoading } = useSWR<WhatsAppConversation[]>(
    isConfigured ? "/api/whatsapp/conversations" : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return (c.customer_name ?? c.phone).toLowerCase().includes(q) || c.phone.includes(q);
  });

  const activeConv = conversations.find(c => c.phone === activePhone);

  function handleDeleted() {
    setActivePhone(null);
    setMobileView("list");
    mutateConversations();
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
          <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>Messaging</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Chat with clients via WhatsApp</div>
        </div>
        <NotConfigured />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {/* Left: conversation list (full-width single pane on mobile) */}
      <div style={{
        width: isMobile ? "100%" : 280, flexShrink: isMobile ? 1 : 0,
        borderRight: isMobile ? "none" : `0.5px solid ${GLASS_BORDER}`,
        display: !isMobile || mobileView === "list" ? "flex" : "none",
        flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden",
      }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginBottom: 10 }}>Chats</div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T3, pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              style={{
                width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                background: GLASS, border: `0.5px solid ${GLASS_BORDER}`,
                borderRadius: 9, fontSize: 12, color: T1, outline: "none", boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {conversationsLoading && conversations.length === 0 ? (
            <MessagingListSkeleton />
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: T3 }}>
              {conversations.length === 0
                ? "No conversations yet. Send a message from an invoice or quotation to start."
                : "No results"}
            </div>
          ) : (
            filtered.map(conv => (
              <ConversationItem
                key={conv.phone}
                conv={conv}
                active={activePhone === conv.phone && (!isMobile || mobileView === "chat")}
                onClick={() => { setActivePhone(conv.phone); setMobileView("chat"); }}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: chat panel (full-screen single pane on mobile) */}
      <div style={{ flex: 1, display: !isMobile || mobileView === "chat" ? "flex" : "none", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {activePhone
          ? <ChatPanel key={activePhone} phone={activePhone} customerName={activeConv?.customer_name} onDeleted={handleDeleted} onReadAll={mutateConversations} isMobile={isMobile} onBack={() => setMobileView("list")} cloudinaryConfigured={cloudinaryConfigured} />
          : <NoChatSelected />
        }
      </div>
    </div>
  );
}
