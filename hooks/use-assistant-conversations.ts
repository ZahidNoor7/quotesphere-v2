"use client";
import { useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { AssistantConversationSummary } from "@/types";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.data ?? []) as AssistantConversationSummary[]);

export function useAssistantConversations(search?: string) {
  const key = search?.trim()
    ? `/api/assistant/conversations?search=${encodeURIComponent(search.trim())}`
    : "/api/assistant/conversations";

  const { data, mutate, isLoading } = useSWR<AssistantConversationSummary[]>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 2000,
    keepPreviousData: true,
  });

  const togglePin = useCallback(
    async (id: string, pinned: boolean) => {
      // Optimistic: flip + re-sort (pinned first, then by updatedAt) immediately.
      await mutate(
        (current) => {
          const next = (current ?? []).map((c) => (c._id === id ? { ...c, pinned } : c));
          next.sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          return next;
        },
        { revalidate: false }
      );
      try {
        const res = await fetch(`/api/assistant/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        void mutate();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Couldn't update pin");
        void mutate(); // roll back to server truth
      }
    },
    [mutate]
  );

  return { conversations: data ?? [], mutate, isLoading, togglePin };
}
