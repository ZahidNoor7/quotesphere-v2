import type { AiAssistantConfig } from "@/types";
import type { LLMProvider } from "./types";
import { createOpenAiProvider, type OpenAiProviderOptions } from "./openai";
import { createOpenAiResponsesProvider } from "./openai-responses";
import { createAnthropicProvider } from "./anthropic";
import { isSafeExternalUrl } from "@/lib/ssrf-guard";

/** Thrown when the active provider is missing required credentials/config. */
export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

/**
 * Build the active LLM provider from the user's saved Settings config, falling
 * back to environment variables for any unset field. Mirrors agent-os's
 * model-router: provider selection + credentials are resolved per request.
 */
export function resolveProvider(cfg?: AiAssistantConfig): LLMProvider {
  const provider = cfg?.provider ?? "openai";

  if (provider === "anthropic") {
    const apiKey = cfg?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!cfg?.apiKey && apiKey) console.warn("[assistant] using platform ANTHROPIC_API_KEY fallback (tenant has no key)");
    if (!apiKey) throw new ProviderConfigError("Anthropic API key is not configured.");
    const model = cfg?.model || process.env.ASSISTANT_MODEL || "claude-sonnet-4-6";
    return createAnthropicProvider({ apiKey, model });
  }

  // Responses API is the default for OpenAI/Azure (covers gpt-5 series and gpt-4o).
  const useChat = cfg?.apiStyle === "chat";
  const build = (opts: OpenAiProviderOptions): LLMProvider =>
    useChat ? createOpenAiProvider(opts) : createOpenAiResponsesProvider(opts);

  if (provider === "azure_openai") {
    const apiKey = cfg?.apiKey || process.env.AZURE_OPENAI_API_KEY;
    const endpoint = cfg?.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = cfg?.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = cfg?.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview";
    if (!apiKey) throw new ProviderConfigError("Azure OpenAI API key is not configured.");
    if (!endpoint) throw new ProviderConfigError("Azure OpenAI endpoint is not configured.");
    if (!deployment) throw new ProviderConfigError("Azure OpenAI deployment is not configured.");
    // SSRF: a tenant-supplied endpoint must be a public https URL (env is trusted).
    if (cfg?.azureEndpoint && !isSafeExternalUrl(cfg.azureEndpoint)) {
      throw new ProviderConfigError("Azure OpenAI endpoint must be a public https URL.");
    }
    return build({ apiKey, model: deployment, azure: { endpoint, apiVersion, deployment } });
  }

  // default: OpenAI
  const apiKey = cfg?.apiKey || process.env.OPENAI_API_KEY;
  if (!cfg?.apiKey && apiKey) console.warn("[assistant] using platform OPENAI_API_KEY fallback (tenant has no key)");
  if (!apiKey) throw new ProviderConfigError("OpenAI API key is not configured.");
  const model = cfg?.model || process.env.ASSISTANT_MODEL || "gpt-4o";
  // SSRF: a tenant-supplied base URL must be a public https URL (env is trusted).
  if (cfg?.baseUrl && !isSafeExternalUrl(cfg.baseUrl)) {
    throw new ProviderConfigError("Custom OpenAI base URL must be a public https URL.");
  }
  return build({ apiKey, model, baseURL: cfg?.baseUrl });
}

export type { LLMProvider, ProviderTool } from "./types";
