import OpenAI, { AzureOpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiAssistantConfig } from "@/types";
import { azureOrigin } from "./providers/openai";
import { isSafeExternalUrl } from "@/lib/ssrf-guard";

/* eslint-disable @typescript-eslint/no-explicit-any */

const billSchema = z.object({
  vendor_name: z.string().optional(),
  bill_date: z.string().optional(),
  currency: z.string().optional(),
  tax: z.number().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number(),
    unit_price: z.number(),
  })).default([]),
});

export type BillExtract = z.infer<typeof billSchema>;

const PROMPT = `You are a precise data-extraction assistant. Read this vendor bill / receipt image and return ONLY a JSON object (no prose, no markdown) with exactly this shape:
{
  "vendor_name": string,            // the seller/vendor name, or "" if unclear
  "bill_date": "YYYY-MM-DD",        // the bill/receipt date, or "" if unclear
  "currency": "PKR"|"USD"|"EUR"|"GBP"|"AED"|"SAR",  // best guess, default "PKR"
  "tax": number,                    // total tax amount as a plain number, 0 if none
  "items": [ { "name": string, "quantity": number, "unit_price": number } ]
}
Rules: numbers are plain numbers (no currency symbols or thousands separators). If a line shows only a total, use quantity 1 and unit_price = that total. Never invent items that are not on the bill. Output the JSON only.`;

/** Pull the first JSON object out of a model response (handles ```json fences). */
function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

/**
 * One-shot vision extraction of a vendor bill into a structured draft.
 * Uses the workspace's configured assistant provider/key/model (with env fallbacks).
 * The model must be vision-capable (gpt-4o / gpt-5 / claude-sonnet, etc.).
 */
export async function extractBillFromImage(cfg: AiAssistantConfig | undefined, imageUrl: string): Promise<BillExtract> {
  // SSRF: the provider fetches this URL server-side. Only allow public https
  // URLs (rejects loopback / private / cloud-metadata hosts).
  if (!isSafeExternalUrl(imageUrl)) {
    throw new Error("The image URL must be a public https link.");
  }
  const provider = cfg?.provider ?? "openai";
  let raw = "";

  if (provider === "anthropic") {
    const apiKey = cfg?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Anthropic API key is not configured.");
    const model = cfg?.model || process.env.ASSISTANT_MODEL || "claude-sonnet-4-6";
    const client = new Anthropic({ apiKey, maxRetries: 3 });
    const res = await client.messages.create({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: PROMPT },
      ] as any }],
    });
    raw = (res.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
  } else if (provider === "azure_openai") {
    const apiKey = cfg?.apiKey || process.env.AZURE_OPENAI_API_KEY;
    const endpoint = cfg?.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = cfg?.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = cfg?.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview";
    if (!apiKey) throw new Error("Azure OpenAI API key is not configured.");
    if (!endpoint || !deployment) throw new Error("Azure OpenAI endpoint/deployment is not configured.");
    const client = new AzureOpenAI({ apiKey, endpoint: azureOrigin(endpoint), apiVersion, deployment, maxRetries: 3 });

    if ((cfg?.apiStyle ?? "responses") === "responses") {
      const res = await client.responses.create({
        model: deployment,
        input: [{ role: "user", content: [
          { type: "input_text", text: PROMPT },
          { type: "input_image", image_url: imageUrl, detail: "auto" },
        ] }] as any,
      });
      raw = (res as any).output_text ?? "";
    } else {
      const res = await client.chat.completions.create({
        model: deployment,
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ] as any }],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      raw = res.choices[0]?.message?.content ?? "";
    }
  } else {
    const apiKey = cfg?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key is not configured.");
    const model = cfg?.model || process.env.ASSISTANT_MODEL || "gpt-4o";
    const client = new OpenAI({ apiKey, baseURL: cfg?.baseUrl, maxRetries: 3 });
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: imageUrl } },
      ] as any }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    raw = res.choices[0]?.message?.content ?? "";
  }

  if (!raw.trim()) throw new Error("The model returned no content.");
  const parsed = billSchema.safeParse(parseJson(raw));
  if (!parsed.success) throw new Error("Couldn't read the bill — try a clearer photo.");
  return parsed.data;
}
