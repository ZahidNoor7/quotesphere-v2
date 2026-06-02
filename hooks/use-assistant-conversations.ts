"use client";
import useSWR from "swr";
import type { AssistantConversationSummary } from "@/types";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.data ?? []) as AssistantConversationSummary[]);

export function useAssistantConversations() {
  const { data, mutate, isLoading } = useSWR<AssistantConversationSummary[]>(
    "/api/assistant/conversations",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 4000 }
  );
  return { conversations: data ?? [], mutate, isLoading };
}
