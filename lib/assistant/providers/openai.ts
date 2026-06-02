import OpenAI, { AzureOpenAI } from "openai";
import type { AssistantMessage } from "@/types";
import type { LLMProvider, ProviderChatParams, ProviderStreamEvent, ProviderTool } from "./types";

/** Reduce a (possibly full) Azure URL to its resource origin, e.g.
 *  https://res.openai.azure.com/openai/responses?api-version=… → https://res.openai.azure.com */
export function azureOrigin(endpoint: string): string {
  try {
    const u = new URL(endpoint);
    return `${u.protocol}//${u.host}`;
  } catch {
    return endpoint.replace(/\/+$/, "");
  }
}

export interface OpenAiProviderOptions {
  apiKey: string;
  /** Model id (OpenAI) — ignored for Azure, where the deployment is used. */
  model: string;
  /** OpenAI-compatible base URL override (proxies / gateways). */
  baseURL?: string;
  /** When present, routes through Azure OpenAI. */
  azure?: { endpoint: string; apiVersion: string; deployment: string };
}

function toOpenAiMessages(
  system: string,
  messages: AssistantMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (m.toolCalls?.length) {
        out.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
          })),
        });
      } else {
        out.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.toolCallId ?? "", content: m.content });
    }
  }
  return out;
}

function toOpenAiTools(tools: ProviderTool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export function createOpenAiProvider(opts: OpenAiProviderOptions): LLMProvider {
  const client = opts.azure
    ? new AzureOpenAI({
        apiKey: opts.apiKey,
        endpoint: azureOrigin(opts.azure.endpoint),
        apiVersion: opts.azure.apiVersion,
        deployment: opts.azure.deployment,
      })
    : new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  const model = opts.azure ? opts.azure.deployment : opts.model;

  return {
    name: opts.azure ? "azure_openai" : "openai",
    async *streamChat({
      system,
      messages,
      tools,
      signal,
    }: ProviderChatParams): AsyncIterable<ProviderStreamEvent> {
      const stream = await client.chat.completions.create(
        {
          model,
          messages: toOpenAiMessages(system, messages),
          tools: tools.length ? toOpenAiTools(tools) : undefined,
          tool_choice: tools.length ? "auto" : undefined,
          stream: true,
        },
        { signal }
      );

      // Tool-call fragments arrive across chunks keyed by index; accumulate then emit.
      const acc = new Map<number, { id: string; name: string; args: string }>();
      let finish: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta?.content) yield { type: "text", delta: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = acc.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            acc.set(idx, cur);
          }
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }

      if (acc.size > 0) {
        for (const { id, name, args } of acc.values()) {
          if (!name) continue;
          let input: Record<string, unknown> = {};
          try {
            input = args ? JSON.parse(args) : {};
          } catch {
            input = {};
          }
          yield { type: "tool_call", id: id || `call_${name}`, name, input };
        }
        yield { type: "done", stopReason: "tool_use" };
      } else {
        yield { type: "done", stopReason: finish === "length" ? "length" : "stop" };
      }
    },
  };
}
