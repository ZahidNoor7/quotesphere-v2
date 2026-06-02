"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { mutate as globalMutate } from "swr";
import type {
  AssistantDocumentCard,
  AssistantMessage,
  AssistantPendingAction,
  AssistantStreamEvent,
  AssistantUiMessage,
  AssistantUiToolEvent,
} from "@/types";
import { toolLabel } from "@/lib/assistant/labels";
import { parseSuggestions } from "@/lib/assistant/suggestions";

const STORAGE_KEY = "qs-assistant-active-conversation";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return new Date().toISOString();
}

interface ChatPayload {
  conversationId?: string | null;
  message?: string;
  approve?: string;
  cancel?: string;
  formValues?: Record<string, string>;
  /** Document status chosen on the confirm card. */
  status?: string;
  /** Uploaded image URLs attached to this message. */
  attachments?: string[];
  /** Tell the server to drop the last persisted user turn before running (edit/retry of a completed turn). */
  replaceLast?: boolean;
}

/** True if the conversation's last turn completed successfully (and was therefore persisted). */
function lastTurnPersisted(msgs: AssistantUiMessage[]): boolean {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant") return !msgs[i].error;
    if (msgs[i].role === "user") return false;
  }
  return false;
}

function lastUserIndex(msgs: AssistantUiMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "user") return i;
  return -1;
}

/** Rehydrate a saved conversation into UI bubbles, preserving tool activity + "View …" links. */
function canonicalToUi(messages: AssistantMessage[]): AssistantUiMessage[] {
  const out: AssistantUiMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      if ((m.content ?? "").trim() || m.attachments?.length) {
        out.push({ id: m.id ?? genId(), role: "user", content: m.content, attachments: m.attachments, createdAt: m.createdAt });
      }
    } else if (m.role === "assistant") {
      const toolEvents: AssistantUiToolEvent[] = (m.toolCalls ?? []).map((tc) => ({
        id: tc.id,
        tool: tc.name,
        label: toolLabel(tc.name),
        status: "done" as const,
      }));
      const parsed = parseSuggestions(m.content ?? "");
      if (parsed.content.trim() || toolEvents.length || m.documentLink || m.documentCard) {
        out.push({
          id: m.id ?? genId(),
          role: "assistant",
          content: parsed.content,
          suggestions: parsed.suggestions.length ? parsed.suggestions : undefined,
          toolEvents: toolEvents.length ? toolEvents : undefined,
          documentLink: m.documentLink,
          documentLabel: m.documentLabel,
          documentCard: m.documentCard,
          createdAt: m.createdAt,
        });
      }
    }
    // tool-result messages are folded into the assistant turn above
  }
  return out;
}

/** Revalidate any open quotation/invoice/customer/product lists after a write. */
function refreshDocumentLists() {
  void globalMutate(
    (key) =>
      typeof key === "string" &&
      (key.startsWith("/api/quotations") ||
        key.startsWith("/api/invoices") ||
        key.startsWith("/api/customers") ||
        key.startsWith("/api/products")),
    undefined,
    { revalidate: true }
  );
}

export interface UseAssistantStream {
  messages: AssistantUiMessage[];
  streamingText: string;
  toolEvents: AssistantUiToolEvent[];
  pendingAction: AssistantPendingAction | null;
  isStreaming: boolean;
  historyLoading: boolean;
  error: string | null;
  conversationId: string | null;
  send: (message: string, attachments?: string[]) => Promise<void>;
  confirm: (opts?: { formValues?: Record<string, string>; status?: string }) => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  editAndResend: (text: string) => Promise<void>;
  stop: () => void;
  newChat: () => void;
  loadConversation: (id: string) => Promise<void>;
}

export function useAssistantStream(
  onConversationChange?: (id: string, title: string) => void
): UseAssistantStream {
  const [messages, setMessages] = useState<AssistantUiMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [toolEvents, setToolEvents] = useState<AssistantUiToolEvent[]>([]);
  const [pendingAction, setPendingAction] = useState<AssistantPendingAction | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Mirror the callback into a ref so runStream stays stable across renders.
  const onChangeRef = useRef(onConversationChange);
  useEffect(() => {
    onChangeRef.current = onConversationChange;
  }, [onConversationChange]);

  const runStream = useCallback(async (payload: ChatPayload) => {
    setIsStreaming(true);
    setError(null);
    setStreamingText("");
    setToolEvents([]);
    setPendingAction(null);

    abortRef.current = new AbortController();
    let assistantText = "";
    const events: AssistantUiToolEvent[] = [];
    let docLink: string | undefined;
    let docLabel: string | undefined;
    let docCard: AssistantDocumentCard | undefined;
    let pending: AssistantPendingAction | null = null;
    let turnError: string | null = null;

    const commitAssistant = () => {
      const { content, suggestions } = parseSuggestions(assistantText);
      if (content || events.length || turnError) {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: "assistant",
            content,
            suggestions: suggestions.length ? suggestions : undefined,
            toolEvents: events.length ? [...events] : undefined,
            documentLink: docLink,
            documentLabel: docLabel,
            documentCard: docCard,
            error: turnError ?? undefined,
            createdAt: now(),
          },
        ]);
      }
      setStreamingText("");
      setToolEvents([]);
    };

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        let msg = "Request failed";
        try {
          const j = await res.json();
          if (typeof j.error === "string") msg = j.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createParser({
        onEvent: (ev) => {
          let data: AssistantStreamEvent;
          try {
            data = JSON.parse(ev.data) as AssistantStreamEvent;
          } catch {
            return;
          }
          switch (data.type) {
            case "text_delta":
              assistantText += data.content;
              setStreamingText(assistantText);
              break;
            case "tool_started":
              events.push({ id: data.id, tool: data.tool, label: data.label, status: "running" });
              setToolEvents([...events]);
              break;
            case "tool_result": {
              const e = events.find((x) => x.id === data.id);
              if (e) {
                e.status = data.ok ? "done" : "error";
                e.summary = data.summary;
              }
              setToolEvents([...events]);
              break;
            }
            case "needs_confirmation":
              setConversationId(data.conversationId);
              onChangeRef.current?.(data.conversationId, data.title);
              pending = data.action;
              break;
            case "completed":
              setConversationId(data.conversationId);
              onChangeRef.current?.(data.conversationId, data.title);
              if (!assistantText && data.message) {
                assistantText = data.message;
                setStreamingText(assistantText);
              }
              docLink = data.documentLink;
              docLabel = data.documentLabel;
              docCard = data.documentCard;
              if (docLink || docCard) refreshDocumentLists();
              break;
            case "error":
              turnError = data.error.message;
              break;
          }
        },
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }

      commitAssistant();
      setPendingAction(pending);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        commitAssistant();
      } else {
        turnError = (err as Error).message ?? "Something went wrong";
        commitAssistant();
        setError(turnError);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (message: string, attachments?: string[]) => {
      if (isStreaming || (!message.trim() && !attachments?.length)) return;
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "user", content: message, attachments, createdAt: now() },
      ]);
      await runStream({ conversationId: conversationId ?? undefined, message, attachments });
    },
    [isStreaming, conversationId, runStream]
  );

  const confirm = useCallback(
    async (opts?: { formValues?: Record<string, string>; status?: string }) => {
      if (!pendingAction || !conversationId || isStreaming) return;
      await runStream({ conversationId, approve: pendingAction.id, formValues: opts?.formValues, status: opts?.status });
    },
    [pendingAction, conversationId, isStreaming, runStream]
  );

  const cancel = useCallback(async () => {
    if (!pendingAction || !conversationId || isStreaming) return;
    await runStream({ conversationId, cancel: pendingAction.id });
  }, [pendingAction, conversationId, isStreaming, runStream]);

  // Re-run the last user message (after an error) without re-adding the bubble.
  const retry = useCallback(async () => {
    if (isStreaming) return;
    const idx = lastUserIndex(messages);
    if (idx === -1) return;
    const text = messages[idx].content;
    const replaceLast = lastTurnPersisted(messages);
    setMessages((prev) => prev.slice(0, idx + 1));
    await runStream({ conversationId: conversationId ?? undefined, message: text, replaceLast });
  }, [isStreaming, messages, conversationId, runStream]);

  // Replace the last user message with edited text and re-run.
  const editAndResend = useCallback(
    async (newText: string) => {
      if (isStreaming || !newText.trim()) return;
      const idx = lastUserIndex(messages);
      if (idx === -1) return;
      const replaceLast = lastTurnPersisted(messages);
      setMessages((prev) => [...prev.slice(0, idx), { id: genId(), role: "user", content: newText, createdAt: now() }]);
      await runStream({ conversationId: conversationId ?? undefined, message: newText, replaceLast });
    },
    [isStreaming, messages, conversationId, runStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingText("");
    setToolEvents([]);
    setPendingAction(null);
    setError(null);
    setConversationId(null);
    setIsStreaming(false);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadConversation = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText("");
    setToolEvents([]);
    setPendingAction(null);
    setError(null);
    setConversationId(id);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load conversation");
      const convo = json.data;
      setMessages(canonicalToUi((convo.messages ?? []) as AssistantMessage[]));
      if (convo.pendingAction) {
        const p = convo.pendingAction;
        setPendingAction({ id: p.id, tool: p.tool, title: p.title, summary: p.summary, preview: p.preview ?? [], form: p.form });
      }
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
    } catch (err: unknown) {
      setMessages([]);
      setConversationId(null);
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      if (!opts?.silent) setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Persist the active conversation so it reopens after a refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (conversationId) localStorage.setItem(STORAGE_KEY, conversationId);
  }, [conversationId]);

  // Restore the last-open conversation on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) void loadConversation(saved, { silent: true });
  }, [loadConversation]);

  return {
    messages,
    streamingText,
    toolEvents,
    pendingAction,
    isStreaming,
    historyLoading,
    error,
    conversationId,
    send,
    confirm,
    cancel,
    retry,
    editAndResend,
    stop,
    newChat,
    loadConversation,
  };
}
