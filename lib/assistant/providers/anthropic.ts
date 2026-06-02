import Anthropic from "@anthropic-ai/sdk";
import type { AssistantMessage } from "@/types";
import type { LLMProvider, ProviderChatParams, ProviderStreamEvent, ProviderTool } from "./types";

const MAX_TOKENS = 4096;

function toAnthropicMessages(messages: AssistantMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
      i++;
    } else if (m.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input ?? {} });
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : m.content || "" });
      i++;
    } else {
      // Anthropic requires every tool_use to be answered by tool_result blocks
      // in a SINGLE following user message — group consecutive tool messages.
      const results: Anthropic.ContentBlockParam[] = [];
      while (i < messages.length && messages[i].role === "tool") {
        const t = messages[i];
        results.push({ type: "tool_result", tool_use_id: t.toolCallId ?? "", content: t.content });
        i++;
      }
      out.push({ role: "user", content: results });
    }
  }
  return out;
}

function toAnthropicTools(tools: ProviderTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

export function createAnthropicProvider(opts: { apiKey: string; model: string }): LLMProvider {
  const client = new Anthropic({ apiKey: opts.apiKey });

  return {
    name: "anthropic",
    async *streamChat({
      system,
      messages,
      tools,
      signal,
    }: ProviderChatParams): AsyncIterable<ProviderStreamEvent> {
      const stream = client.messages.stream(
        {
          model: opts.model,
          max_tokens: MAX_TOKENS,
          system,
          messages: toAnthropicMessages(messages),
          tools: tools.length ? toAnthropicTools(tools) : undefined,
        },
        { signal }
      );

      const toolAcc = new Map<number, { id: string; name: string; json: string }>();
      let stopReason: string | null = null;

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          const cb = event.content_block;
          if (cb.type === "tool_use") {
            toolAcc.set(event.index, { id: cb.id, name: cb.name, json: "" });
          }
        } else if (event.type === "content_block_delta") {
          const d = event.delta;
          if (d.type === "text_delta") {
            yield { type: "text", delta: d.text };
          } else if (d.type === "input_json_delta") {
            const cur = toolAcc.get(event.index);
            if (cur) cur.json += d.partial_json;
          }
        } else if (event.type === "message_delta") {
          if (event.delta.stop_reason) stopReason = event.delta.stop_reason;
        }
      }

      if (toolAcc.size > 0) {
        for (const { id, name, json } of toolAcc.values()) {
          let input: Record<string, unknown> = {};
          try {
            input = json ? JSON.parse(json) : {};
          } catch {
            input = {};
          }
          yield { type: "tool_call", id, name, input };
        }
        yield { type: "done", stopReason: "tool_use" };
      } else {
        yield { type: "done", stopReason: stopReason === "max_tokens" ? "length" : "stop" };
      }
    },
  };
}
