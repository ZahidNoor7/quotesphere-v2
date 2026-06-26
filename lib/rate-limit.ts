import clientPromise from "@/lib/db";

export interface RateLimitResult {
  success: boolean;
  /** Milliseconds until the window resets (only set when success === false) */
  retryAfterMs: number;
}

// ─── Ensure TTL index exists once per process ──────────────────────────────────
let _indexEnsured = false;
async function ensureIndex() {
  if (_indexEnsured) return;
  try {
    const client = await clientPromise;
    const coll = client.db().collection("_rate_limits");
    await coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
    await coll.createIndex({ key: 1 }, { background: true });
    _indexEnsured = true;
  } catch {
    // Non-fatal — index will be created eventually
  }
}

/**
 * Distributed fixed-window rate limiter backed by MongoDB.
 * Works across all instances/serverless functions — safe for Vercel deployments.
 *
 * @param key      Unique string identifying the rate-limit bucket (e.g. "login:1.2.3.4")
 * @param limit    Maximum number of requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    await ensureIndex();
    const client = await clientPromise;
    const coll = client.db().collection<{ key: string; count: number; expiresAt: Date }>("_rate_limits");

    const now = new Date();
    // Align to fixed window boundaries so all instances agree on the same window
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const expiresAt = new Date(windowStart + windowMs);
    const windowKey = `${key}:${windowStart}`;

    const doc = await coll.findOneAndUpdate(
      { key: windowKey },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" }
    );

    if (!doc) return { success: true, retryAfterMs: 0 };

    if (doc.count > limit) {
      return { success: false, retryAfterMs: expiresAt.getTime() - now.getTime() };
    }
    return { success: true, retryAfterMs: 0 };
  } catch {
    // Fail open — never block users due to a rate-limit DB error
    return { success: true, retryAfterMs: 0 };
  }
}

/**
 * Best-effort client IP for rate-limit keys.
 *
 * Prefers `x-real-ip` (a single value the platform/proxy sets) over
 * `x-forwarded-for`, whose FIRST entry is client-supplied and can be spoofed by
 * prepending fake hops to mint fresh buckets. These keys are only as trustworthy
 * as the proxy in front of the app — deploy behind one (e.g. Vercel) that
 * overwrites both headers.
 */
export function getClientIP(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}
