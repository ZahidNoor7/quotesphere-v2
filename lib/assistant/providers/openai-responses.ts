import OpenAI from "openai";
import type { AssistantMessage } from "@/types";
import { userText, type LLMProvider, type ProviderChatParams, type ProviderStreamEvent, type ProviderTool } from "./types";
import { azureOrigin, type OpenAiProviderOptions } from "./openai";

/**
 * OpenAI / Azure OpenAI adapter using the **Responses API** (`/openai/responses`).
 * Required for the gpt-5 series and the newer Azure endpoints, where the
 * Chat Completions `messages` field has moved to `input`.
 */

function toResponsesInput(messages: AssistantMessage[]): OpenAI.Responses.ResponseInputItem[] {
  const input: OpenAI.Responses.ResponseInputItem[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      input.push({ role: "user", content: userText(m) });
    } else if (m.role === "assistant") {
      if (m.content) input.push({ role: "assistant", content: m.content });
      for (const tc of m.toolCalls ?? []) {
        input.push({
          type: "function_call",
          call_id: tc.id,
          name: tc.name,
          arguments: JSON.stringify(tc.input ?? {}),
        });
      }
    } else if (m.role === "tool") {
      input.push({ type: "function_call_output", call_id: m.toolCallId ?? "", output: m.content });
    }
  }
  return input;
}

function toResponsesTools(tools: ProviderTool[]): OpenAI.Responses.Tool[] {
  return tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
    strict: false,
  }));
}

function buildClient(opts: OpenAiProviderOptions): { client: OpenAI; model: string; name: string } {
  if (opts.azure) {
    const base = azureOrigin(opts.azure.endpoint);
    const client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: `${base}/openai`,
      defaultQuery: { "api-version": opts.azure.apiVersion },
      defaultHeaders: { "api-key": opts.apiKey },
      maxRetries: 4,
    });
    return { client, model: opts.azure.deployment, name: "azure_openai" };
  }
  return {
    client: new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL, maxRetries: 4 }),
    model: opts.model,
    name: "openai",
  };
}

export function createOpenAiResponsesProvider(opts: OpenAiProviderOptions): LLMProvider {
  const { client, model, name } = buildClient(opts);

  return {
    name,
    async *streamChat({
      system,
      messages,
      tools,
      signal,
    }: ProviderChatParams): AsyncIterable<ProviderStreamEvent> {
      const stream = await client.responses.create(
        {
          model,
          instructions: system,
          input: toResponsesInput(messages),
          tools: tools.length ? toResponsesTools(tools) : undefined,
          stream: true,
        },
        { signal }
      );

      let sawTool = false;
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          yield { type: "text", delta: event.delta };
        } else if (event.type === "response.output_item.done") {
          const item = event.item;
          if (item.type === "function_call") {
            sawTool = true;
            let parsed: Record<string, unknown> = {};
            try {
              parsed = item.arguments ? JSON.parse(item.arguments) : {};
            } catch {
              parsed = {};
            }
            yield { type: "tool_call", id: item.call_id, name: item.name, input: parsed };
          }
        }
      }

      yield { type: "done", stopReason: sawTool ? "tool_use" : "stop" };
    },
  };
}
