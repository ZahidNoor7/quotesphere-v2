"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { mutate as globalMutate } from "swr";
import type {
  AssistantMessage,
  AssistantPendingAction,
  AssistantStreamEvent,
  AssistantUiMessage,
  AssistantUiToolEvent,
} from "@/types";
import { toolLabel } from "@/lib/assistant/labels";

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
}

/** Rehydrate a saved conversation into UI bubbles, preserving tool activity + "View …" links. */
function canonicalToUi(messages: AssistantMessage[]): AssistantUiMessage[] {
  const out: AssistantUiMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      if ((m.content ?? "").trim()) {
        out.push({ id: m.id ?? genId(), role: "user", content: m.content, createdAt: m.createdAt });
      }
    } else if (m.role === "assistant") {
      const toolEvents: AssistantUiToolEvent[] = (m.toolCalls ?? []).map((tc) => ({
        id: tc.id,
        tool: tc.name,
        label: toolLabel(tc.name),
        status: "done" as const,
      }));
      if ((m.content ?? "").trim() || toolEvents.length || m.documentLink) {
        out.push({
          id: m.id ?? genId(),
          role: "assistant",
          content: m.content ?? "",
          toolEvents: toolEvents.length ? toolEvents : undefined,
          documentLink: m.documentLink,
          documentLabel: m.documentLabel,
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
  error: string | null;
  conversationId: string | null;
  send: (message: string) => Promise<void>;
  confirm: (formValues?: Record<string, string>) => Promise<void>;
  cancel: () => Promise<void>;
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
    let pending: AssistantPendingAction | null = null;
    let turnError: string | null = null;

    const commitAssistant = () => {
      if (assistantText || events.length || turnError) {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: "assistant",
            content: assistantText,
            toolEvents: events.length ? [...events] : undefined,
            documentLink: docLink,
            documentLabel: docLabel,
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
              if (docLink) refreshDocumentLists();
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
    async (message: string) => {
      if (isStreaming || !message.trim()) return;
      setMessages((prev) => [...prev, { id: genId(), role: "user", content: message, createdAt: now() }]);
      await runStream({ conversationId: conversationId ?? undefined, message });
    },
    [isStreaming, conversationId, runStream]
  );

  const confirm = useCallback(
    async (formValues?: Record<string, string>) => {
      if (!pendingAction || !conversationId || isStreaming) return;
      await runStream({ conversationId, approve: pendingAction.id, formValues });
    },
    [pendingAction, conversationId, isStreaming, runStream]
  );

  const cancel = useCallback(async () => {
    if (!pendingAction || !conversationId || isStreaming) return;
    await runStream({ conversationId, cancel: pendingAction.id });
  }, [pendingAction, conversationId, isStreaming, runStream]);

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
    error,
    conversationId,
    send,
    confirm,
    cancel,
    stop,
    newChat,
    loadConversation,
  };
}
