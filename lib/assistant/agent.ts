import { randomUUID } from "crypto";
import type {
  AssistantDocumentCard,
  AssistantMessage,
  AssistantPendingAction,
  AssistantStreamEvent,
  AssistantToolCall,
} from "@/types";

interface Carried {
  documentLink?: string;
  documentLabel?: string;
  documentCard?: AssistantDocumentCard;
}
import type { LLMProvider } from "./providers/types";
import { providerTools, TOOL_MAP } from "./tools";
import { buildPendingAction, executeReadTool, runPendingAction } from "./executor";
import { toolLabel as labelFor } from "./labels";
import type { SiblingToolResult, StoredPendingAction, ToolContext } from "./types";

const MAX_ITERATIONS = 8;

type Emit = (event: AssistantStreamEvent) => void;

export interface AgentRunParams {
  provider: LLMProvider;
  system: string;
  toolCtx: ToolContext;
  /** Full canonical history — mutated in place and returned in the outcome. */
  messages: AssistantMessage[];
  emit: Emit;
  signal?: AbortSignal;
}

export type TurnOutcome =
  | {
      status: "completed";
      messages: AssistantMessage[];
      finalText: string;
      documentLink?: string;
      documentLabel?: string;
      documentCard?: AssistantDocumentCard;
    }
  | { status: "paused"; messages: AssistantMessage[]; pending: StoredPendingAction };

function newMsg(
  role: AssistantMessage["role"],
  content: string,
  extra?: Partial<AssistantMessage>
): AssistantMessage {
  return { id: randomUUID(), role, content, createdAt: new Date().toISOString(), ...extra };
}

/** Strip server-only execution detail before sending a pending action to the client. */
export function toClientAction(p: StoredPendingAction): AssistantPendingAction {
  return {
    id: p.id,
    tool: p.tool,
    title: p.title,
    summary: p.summary,
    preview: p.preview,
    form: p.form,
    statusValue: p.statusValue,
    statusOptions: p.statusOptions,
  };
}

const cancelContent = (message: string) => JSON.stringify({ cancelled: true, message });

/**
 * Append tool-result turns that cancel a pending action without executing it —
 * used when the user sends a new instruction instead of confirming. Keeps the
 * message history protocol-valid (every tool_use is answered).
 */
export function appendCancellationResults(messages: AssistantMessage[], pending: StoredPendingAction): void {
  messages.push(
    newMsg("tool", cancelContent("Superseded by a new user instruction — do not perform unless asked again."), {
      toolCallId: pending.toolCallId,
      toolName: pending.tool,
    })
  );
  for (const s of pending.siblingResults) {
    messages.push(newMsg("tool", s.content, { toolCallId: s.toolCallId, toolName: s.toolName }));
  }
}

// ─── The agentic loop ─────────────────────────────────────────────────────────

async function loop(params: AgentRunParams, carried?: Carried): Promise<TurnOutcome> {
  const { provider, system, toolCtx, messages, emit, signal } = params;
  const documentLink = carried?.documentLink;
  const documentLabel = carried?.documentLabel;
  const documentCard = carried?.documentCard;
  const tools = providerTools();

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let text = "";
    const toolCalls: AssistantToolCall[] = [];

    for await (const ev of provider.streamChat({ system, messages, tools, signal })) {
      if (ev.type === "text") {
        text += ev.delta;
        emit({ type: "text_delta", content: ev.delta });
      } else if (ev.type === "tool_call") {
        toolCalls.push({ id: ev.id, name: ev.name, input: ev.input });
      }
    }

    // No tools → final answer. Persist the document link onto this turn so the
    // "View …" CTA survives a page reload.
    if (toolCalls.length === 0) {
      const meta = documentLink || documentCard ? { documentLink, documentLabel, documentCard } : undefined;
      messages.push(newMsg("assistant", text, meta));
      return { status: "completed", messages, finalText: text, documentLink, documentLabel, documentCard };
    }

    // Record the assistant turn that requested the tools.
    messages.push(newMsg("assistant", text, { toolCalls }));

    const writeCalls = toolCalls.filter((tc) => TOOL_MAP[tc.name]?.kind === "write");

    // Read-only turn → execute everything and continue the loop.
    if (writeCalls.length === 0) {
      for (const tc of toolCalls) {
        emit({ type: "tool_started", id: tc.id, tool: tc.name, label: labelFor(tc.name) });
        const res = await executeReadTool(tc.name, tc.input, toolCtx);
        emit({ type: "tool_result", id: tc.id, tool: tc.name, ok: res.ok, summary: res.summary });
        messages.push(newMsg("tool", JSON.stringify(res.data), { toolCallId: tc.id, toolName: tc.name }));
      }
      continue;
    }

    // A write is requested → build the pending action (validate, permission, totals).
    const firstWrite = writeCalls[0];
    emit({ type: "tool_started", id: firstWrite.id, tool: firstWrite.name, label: labelFor(firstWrite.name) });
    const built = await buildPendingAction(firstWrite.id, firstWrite.name, firstWrite.input, toolCtx);

    if ("error" in built) {
      // Validation / permission failed → feed the error back and let the model recover.
      emit({ type: "tool_result", id: firstWrite.id, tool: firstWrite.name, ok: false, summary: built.error });
      for (const tc of toolCalls) {
        if (tc.id === firstWrite.id) {
          messages.push(newMsg("tool", JSON.stringify({ error: built.error }), { toolCallId: tc.id, toolName: tc.name }));
        } else if (TOOL_MAP[tc.name]?.kind === "write") {
          messages.push(
            newMsg("tool", JSON.stringify({ error: "Only one action at a time. Propose this one next." }), {
              toolCallId: tc.id,
              toolName: tc.name,
            })
          );
        } else {
          emit({ type: "tool_started", id: tc.id, tool: tc.name, label: labelFor(tc.name) });
          const res = await executeReadTool(tc.name, tc.input, toolCtx);
          emit({ type: "tool_result", id: tc.id, tool: tc.name, ok: res.ok, summary: res.summary });
          messages.push(newMsg("tool", JSON.stringify(res.data), { toolCallId: tc.id, toolName: tc.name }));
        }
      }
      continue;
    }

    // Built OK → resolve sibling tool calls now (so resume can answer every tool_use), then pause.
    const siblingResults: SiblingToolResult[] = [];
    for (const tc of toolCalls) {
      if (tc.id === firstWrite.id) continue;
      if (TOOL_MAP[tc.name]?.kind === "write") {
        siblingResults.push({
          toolCallId: tc.id,
          toolName: tc.name,
          content: JSON.stringify({ error: "Only one action can be confirmed at a time. Propose this one next." }),
        });
      } else {
        emit({ type: "tool_started", id: tc.id, tool: tc.name, label: labelFor(tc.name) });
        const res = await executeReadTool(tc.name, tc.input, toolCtx);
        emit({ type: "tool_result", id: tc.id, tool: tc.name, ok: res.ok, summary: res.summary });
        siblingResults.push({ toolCallId: tc.id, toolName: tc.name, content: JSON.stringify(res.data) });
      }
    }

    emit({ type: "tool_result", id: firstWrite.id, tool: firstWrite.name, ok: true, summary: "Awaiting your confirmation" });
    return { status: "paused", messages, pending: { ...built, siblingResults } };
  }

  const msg = "I couldn't complete that within a reasonable number of steps. Could you rephrase or break it into smaller asks?";
  messages.push(newMsg("assistant", msg));
  return { status: "completed", messages, finalText: msg, documentLink, documentLabel, documentCard };
}

// ─── Entry points used by the route ───────────────────────────────────────────

export async function runTurn(
  params: AgentRunParams,
  userMessage: string,
  attachments?: string[]
): Promise<TurnOutcome> {
  params.messages.push(newMsg("user", userMessage, attachments?.length ? { attachments } : undefined));
  return loop(params);
}

export async function resumeTurn(
  params: AgentRunParams,
  pending: StoredPendingAction,
  decision: "approve" | "cancel"
): Promise<TurnOutcome> {
  const { emit, toolCtx, messages } = params;
  let carried: Carried | undefined;
  let writeResultContent: string;

  if (decision === "approve") {
    emit({ type: "tool_started", id: pending.toolCallId, tool: pending.tool, label: pending.title });
    const r = await runPendingAction(pending, toolCtx);
    emit({ type: "tool_result", id: pending.toolCallId, tool: pending.tool, ok: r.ok, summary: r.summary });
    writeResultContent = JSON.stringify(r.data);
    if (r.ok) carried = { documentLink: r.documentLink, documentLabel: r.documentLabel, documentCard: r.card };
  } else {
    emit({ type: "tool_result", id: pending.toolCallId, tool: pending.tool, ok: false, summary: "Cancelled" });
    writeResultContent = cancelContent("The user declined this action. Do not perform it unless they ask again.");
  }

  // Answer every tool_use from the paused assistant turn (the write + its siblings).
  messages.push(newMsg("tool", writeResultContent, { toolCallId: pending.toolCallId, toolName: pending.tool }));
  for (const s of pending.siblingResults) {
    messages.push(newMsg("tool", s.content, { toolCallId: s.toolCallId, toolName: s.toolName }));
  }

  return loop(params, carried);
}
