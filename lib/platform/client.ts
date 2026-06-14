"use client";

/** Shared fetcher for platform SWR hooks. Returns the parsed JSON envelope. */
export const platformFetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * POST/PUT/DELETE helper for portal mutations. Resolves to `data` on success,
 * throws an Error with the server message otherwise (caught by the caller for a
 * sonner toast).
 */
export async function platformMutate<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    const msg = typeof json?.error === "string" ? json.error : "Request failed. Please try again.";
    throw new Error(msg);
  }
  return json.data as T;
}
