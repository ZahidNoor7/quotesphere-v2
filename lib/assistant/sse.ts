import type { AssistantStreamEvent } from "@/types";
import { describeAgentError } from "./errors";

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable any proxy buffering / gzip so events flush per-chunk.
  "Content-Encoding": "identity",
  "X-Accel-Buffering": "no",
};

/**
 * Wrap an async producer in a Server-Sent-Events Response. The producer receives
 * a `send` function and runs inside the stream's lifecycle; any thrown error is
 * surfaced as a final `error` event and the stream is always closed.
 */
export function streamSse(
  run: (send: (event: AssistantStreamEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await run(send);
      } catch (err) {
        try {
          send({ type: "error", error: { message: describeAgentError(err) } });
        } catch {
          /* controller already closed */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
