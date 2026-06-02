import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import AssistantConversation from "@/models/AssistantConversation";
import type { AiAssistantConfig, AssistantMessage, UserRole } from "@/types";
import { getBaseUrl } from "@/lib/assistant/base-url";
import { resolveProvider, ProviderConfigError } from "@/lib/assistant/providers";
import { buildSystemPrompt } from "@/lib/assistant/prompt";
import { describeAgentError } from "@/lib/assistant/errors";
import { streamSse } from "@/lib/assistant/sse";
import {
  appendCancellationResults,
  resumeTurn,
  runTurn,
  toClientAction,
  type AgentRunParams,
} from "@/lib/assistant/agent";
import type { StoredPendingAction, ToolContext } from "@/lib/assistant/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().nullable().optional(),
  message: z.string().max(8000).optional(),
  approve: z.string().optional(),
  cancel: z.string().optional(),
  /** User-completed values from a form-style confirmation card (e.g. new customer). */
  formValues: z.record(z.string(), z.string()).optional(),
  /** Document status chosen on the confirm card. */
  status: z.string().max(40).optional(),
  /** Uploaded image URLs attached to this message (referenced by line items via image_index). */
  attachments: z.array(z.string().max(2000)).max(20).optional(),
  /** Drop the last persisted user turn before running (edit/retry of a completed turn). */
  replaceLast: z.boolean().optional(),
});

function deriveTitle(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || "New chat";
}

/** Most recent user message's attachments — so an image survives the customer-creation pause. */
function lastUserAttachments(msgs: AssistantMessage[]): string[] {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === "user" && m.attachments?.length) return m.attachments;
  }
  return [];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id as string;
  const role = (session.user as { role?: UserRole }).role;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const isDecision = !!(body.approve || body.cancel);
  if (!isDecision && !body.message?.trim()) {
    return NextResponse.json({ success: false, error: "A message is required" }, { status: 400 });
  }
  if (isDecision && !body.conversationId) {
    return NextResponse.json({ success: false, error: "conversationId is required to confirm an action" }, { status: 400 });
  }

  await connectDB();

  const settings = (await Settings.findOne({ user_id: userId }).lean()) as
    | { integrations?: { aiAssistant?: AiAssistantConfig }; default_currency?: string }
    | null;
  const cfg = settings?.integrations?.aiAssistant;
  const defaultCurrency = settings?.default_currency ?? "PKR";
  const cookie = req.headers.get("cookie") ?? "";

  // Load existing conversation (or defer creation for a brand-new chat).
  let convoId = body.conversationId ?? null;
  let title = body.message ? deriveTitle(body.message) : "New chat";
  let messages: AssistantMessage[] = [];
  let pending: StoredPendingAction | null = null;

  if (convoId) {
    const existing = (await AssistantConversation.findOne({ _id: convoId, user_id: userId }).lean()) as {
      title: string;
      messages?: AssistantMessage[];
      pendingAction?: StoredPendingAction | null;
    } | null;
    if (!existing) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    title = existing.title;
    messages = (existing.messages ?? []) as unknown as AssistantMessage[];
    pending = (existing.pendingAction ?? null) as StoredPendingAction | null;
  }

  // Edit/retry of a completed turn → drop the last user message and everything after it.
  if (body.replaceLast && !isDecision && messages.length) {
    let cut = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        cut = i;
        break;
      }
    }
    messages = messages.slice(0, cut);
  }

  // Images attached this turn — or, on a resume after the customer form, the ones
  // from the original message (still in history).
  const turnAttachments = body.attachments?.length ? body.attachments : lastUserAttachments(messages);

  async function persist(finalMessages: AssistantMessage[], finalPending: StoredPendingAction | null) {
    if (convoId) {
      await AssistantConversation.updateOne(
        { _id: convoId, user_id: userId },
        { $set: { messages: finalMessages, pendingAction: finalPending, title } }
      );
    } else {
      // Canonical messages carry an ISO-string createdAt vs the schema's Date —
      // cast at this persistence boundary (Mongoose coerces the string to a Date).
      const created = new AssistantConversation({
        user_id: userId,
        title,
        messages: finalMessages,
        pendingAction: finalPending,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      await created.save();
      convoId = String(created._id);
    }
  }

  return streamSse(async (send) => {
    let provider;
    try {
      provider = resolveProvider(cfg);
    } catch (e) {
      const base = e instanceof ProviderConfigError ? e.message : "Failed to initialize the AI provider.";
      send({ type: "error", error: { message: `${base} Configure it in Settings → Integrations → AI Assistant.` } });
      return;
    }

    const toolCtx: ToolContext = { cookie, baseUrl: getBaseUrl(), role, defaultCurrency, attachments: turnAttachments };
    const params: AgentRunParams = {
      provider,
      system: buildSystemPrompt({
        today: new Date().toISOString().slice(0, 10),
        defaultCurrency,
        userName: session.user?.name ?? undefined,
      }),
      toolCtx,
      messages,
      emit: send,
      signal: req.signal,
    };

    try {
      let outcome;
      if (isDecision) {
        if (!pending || pending.id !== (body.approve ?? body.cancel)) {
          send({ type: "error", error: { message: "That action is no longer pending." } });
          return;
        }
        // Merge user-completed form fields (restricted to the form's own keys).
        if (body.approve && pending.form && body.formValues) {
          const allowed = new Set(pending.form.map((f) => f.key));
          const merged: Record<string, unknown> = { ...pending.payload };
          for (const [k, v] of Object.entries(body.formValues)) {
            if (allowed.has(k)) merged[k] = v;
          }
          pending.payload = merged;
        }
        // Apply the status chosen on the confirm card.
        if (body.approve && body.status && pending.statusOptions?.some((o) => o.value === body.status)) {
          (pending.payload as Record<string, unknown>).status = body.status;
        }
        outcome = await resumeTurn(params, pending, body.approve ? "approve" : "cancel");
      } else {
        if (pending) appendCancellationResults(messages, pending);
        outcome = await runTurn(params, body.message as string, body.attachments);
      }

      if (outcome.status === "paused") {
        await persist(outcome.messages, outcome.pending);
        send({ type: "needs_confirmation", conversationId: convoId as string, title, action: toClientAction(outcome.pending) });
      } else {
        await persist(outcome.messages, null);
        send({
          type: "completed",
          conversationId: convoId as string,
          title,
          message: outcome.finalText,
          documentLink: outcome.documentLink,
          documentLabel: outcome.documentLabel,
          documentCard: outcome.documentCard,
        });
      }
    } catch (e) {
      if (req.signal?.aborted) return; // client disconnected — discard partial turn
      send({ type: "error", error: { message: describeAgentError(e) } });
    }
  });
}
