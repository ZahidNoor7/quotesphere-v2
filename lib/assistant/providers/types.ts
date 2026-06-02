import type { AssistantMessage } from "@/types";

/** A tool definition in provider-neutral form (JSON Schema input). */
export interface ProviderTool {
  name: string;
  description: string;
  /** JSON Schema object describing the tool inputs. */
  inputSchema: Record<string, unknown>;
}

/** Normalized streaming event emitted by every provider adapter. */
export type ProviderStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { type: "done"; stopReason: "tool_use" | "stop" | "length" };

export interface ProviderChatParams {
  system: string;
  messages: AssistantMessage[];
  tools: ProviderTool[];
  signal?: AbortSignal;
}

/**
 * Provider-agnostic chat interface. Each adapter (OpenAI/Azure, Anthropic)
 * translates the canonical AssistantMessage history + tools into its own wire
 * format and normalizes the streamed response back into ProviderStreamEvents,
 * so the agent loop never needs to know which provider is active.
 */
export interface LLMProvider {
  readonly name: string;
  streamChat(params: ProviderChatParams): AsyncIterable<ProviderStreamEvent>;
}

/** User-facing text for a message, with a note appended when images are attached. */
export function userText(m: AssistantMessage): string {
  if (m.attachments?.length) {
    return `${m.content}\n\n[The user attached ${m.attachments.length} image(s), numbered 0 to ${m.attachments.length - 1}. To put one on a line item, set that item's image_index to its number.]`;
  }
  return m.content;
}
