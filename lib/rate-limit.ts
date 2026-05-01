// In-memory sliding-window rate limiter.
// Works correctly on traditional Node.js deployments. For serverless/edge
// (Vercel, Cloudflare Workers) replace the Map store with @upstash/ratelimit + Redis.

interface Entry {
  count: number;
  resetAt: number;
}

// Module-level store — persists across requests in a single Node.js process.
// Use a global symbol to survive Next.js HMR hot-reloads in development.
const STORE_KEY = Symbol.for("__qs_rate_limit_store");
if (!(globalThis as any)[STORE_KEY]) {
  (globalThis as any)[STORE_KEY] = new Map<string, Entry>();
}
const store: Map<string, Entry> = (globalThis as any)[STORE_KEY];

// Clean up entries that have already expired (runs every 10 minutes).
const CLEANUP_KEY = Symbol.for("__qs_rate_limit_cleanup");
if (!(globalThis as any)[CLEANUP_KEY]) {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 10 * 60 * 1000);
  // Don't block process exit in Node.js
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  (globalThis as any)[CLEANUP_KEY] = timer;
}

export interface RateLimitResult {
  success: boolean;
  /** Milliseconds until the window resets (only set when success === false) */
  retryAfterMs: number;
}

/**
 * @param key      Unique string identifying the rate-limit bucket (e.g. "login:1.2.3.4")
 * @param limit    Maximum number of requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    return { success: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { success: true, retryAfterMs: 0 };
}

/**
 * Extract the real client IP from request headers, falling back gracefully.
 */
export function getClientIP(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
