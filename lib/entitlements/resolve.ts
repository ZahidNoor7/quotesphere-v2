import Subscription from "@/models/Subscription";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { buildEntitlements, emptyBlockedEntitlements } from "@/lib/subscriptions/state";
import { runWithOrg } from "@/lib/tenant-context";
import { connectDB } from "@/lib/mongoose";
import type { Entitlements } from "@/types";

/**
 * Resolve a tenant's effective entitlements (status + feature set). This is the
 * single source the app layout, API gate, sidebar and module guards consume.
 *
 * Backed by a short-TTL in-process cache keyed by org so we don't run a findOne
 * on every request at scale; Mongo stays the source of truth and the cache is
 * invalidated on any subscription mutation (portal actions, cron, signup seed).
 * Effective status is computed lazily from dates, so access is correct even if a
 * status-materializing cron lags.
 */
interface CacheEntry { value: Entitlements; expires: number }

const g = globalThis as typeof globalThis & { __qsEnt?: Map<string, CacheEntry> };
const cache = (g.__qsEnt ??= new Map<string, CacheEntry>());
const TTL_MS = 30_000;

export async function resolveEntitlements(
  orgId: string,
  opts?: { fresh?: boolean },
): Promise<Entitlements> {
  const nowMs = Date.now();
  if (!opts?.fresh) {
    const hit = cache.get(orgId);
    if (hit && hit.expires > nowMs) return hit.value;
  }
  await connectDB();
  const settings = await getPlatformSettings();
  const sub = await runWithOrg(orgId, async () =>
    await Subscription.findOne({ org_id: orgId }).lean(),
  );
  const value = sub
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? buildEntitlements(sub as any, settings.default_grace_period_days, new Date())
    : emptyBlockedEntitlements();
  cache.set(orgId, { value, expires: nowMs + TTL_MS });
  return value;
}

/** Drop the cached entitlements for an org (call after any subscription mutation). */
export function invalidateEntitlements(orgId: string): void {
  cache.delete(orgId);
}
