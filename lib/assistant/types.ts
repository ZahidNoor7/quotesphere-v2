import type { AssistantDocumentCard, AssistantFormField, AssistantPendingActionPreview, UserRole } from "@/types";

/** Per-request context the executor needs to call quotesphere's own APIs. */
export interface ToolContext {
  /** The caller's session cookie, forwarded verbatim so the called route's auth() + requireRole() apply. */
  cookie: string;
  /** App origin for server-to-server self-calls. */
  baseUrl: string;
  /** The caller's role, used to gate writes (closes the convert/payments role gaps). */
  role?: UserRole;
  /** The user's default currency, used when the model doesn't specify one. */
  defaultCurrency: string;
  /** Image URLs attached to this turn, referenced by line items via image_index. */
  attachments: string[];
}

/** A tool result for a non-write tool that ran alongside a paused write. */
export interface SiblingToolResult {
  toolCallId: string;
  toolName: string;
  content: string;
}

/**
 * A write the assistant proposed but has NOT executed. Stored on the
 * conversation (server-authoritative) until the user confirms via the card.
 */
export interface StoredPendingAction {
  id: string;
  /** Originating tool_use id — needed to pair the tool_result on resume. */
  toolCallId: string;
  tool: string;
  method: "POST" | "PUT";
  endpoint: string;
  /** Final, totals-computed payload that will be sent to the endpoint on approve. */
  payload: Record<string, unknown>;
  title: string;
  summary: string;
  preview: AssistantPendingActionPreview[];
  /** When present, the confirm card is an editable form the user completes. */
  form?: AssistantFormField[];
  /** Lets the user choose the document status on the card before saving. */
  statusValue?: string;
  statusOptions?: { value: string; label: string }[];
  docType?: "quotation" | "invoice" | "customer";
  /** Results of any non-write tools the model called in the same (paused) turn. */
  siblingResults: SiblingToolResult[];
}

export interface ReadToolResult {
  ok: boolean;
  summary: string;
  /** Compact JSON-serializable data fed back to the model as the tool result. */
  data: unknown;
}

export interface WriteExecResult {
  ok: boolean;
  data: unknown;
  summary: string;
  documentLink?: string;
  documentLabel?: string;
  card?: AssistantDocumentCard;
}
