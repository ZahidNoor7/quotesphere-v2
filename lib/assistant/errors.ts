// Turn provider/SDK errors into a clear, user-facing message. The OpenAI/Anthropic
// SDKs throw APIConnectionError (message "Connection error.") on network failures,
// and APIError with a status for 4xx/5xx — surface something actionable for each.
export function describeAgentError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { name?: string; status?: number; message?: string; error?: { message?: string } };
    const msg = err.message ?? "";

    if (err.name === "APIConnectionError" || err.name === "APIConnectionTimeoutError" || /connection error/i.test(msg)) {
      return "Couldn't reach the AI provider (connection error). This is usually a brief network hiccup — please tap Retry.";
    }
    if (err.name === "APIUserAbortError" || /aborted/i.test(msg)) {
      return "The request was cancelled.";
    }
    if (typeof err.status === "number") {
      const inner = err.error?.message ?? msg;
      return `AI provider error ${err.status}${inner ? `: ${inner}` : ""}`;
    }
    if (msg) return msg;
  }
  return "The assistant hit an unexpected error. Please tap Retry.";
}
