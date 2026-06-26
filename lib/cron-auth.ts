import crypto from "crypto";

/**
 * Authorize a Vercel cron invocation via the `Authorization: Bearer <CRON_SECRET>`
 * header using a CONSTANT-TIME comparison (no timing oracle on the secret).
 * When CRON_SECRET is unset (local dev) the check is skipped — it MUST be set in
 * any deployed environment.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail-CLOSED in production: an unset secret must never expose the cron
    // endpoints (they run in bypass mode across all orgs). Dev/test stay open.
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
