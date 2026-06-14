import type {
  Entitlements,
  EntitlementNotice,
  FeatureKey,
  SubscriptionStatus,
  BillingInterval,
} from "@/types";
import { ALWAYS_ON_FEATURES } from "@/lib/entitlements/features";

/**
 * Pure subscription state logic — no DB, no `Date.now()` baked in (callers pass
 * `now`). Two jobs:
 *   1. `computeEffectiveStatus` / `buildEntitlements` — lazily derive the *real*
 *      access state from stored status + dates, so access is correct even if the
 *      materializing cron lags.
 *   2. `VALID_TRANSITIONS` / `assertTransition` — guard portal-driven mutations.
 *
 * Access policy (per product decision):
 *   trialing | active | past_due (in grace) | canceled (before period end) → FULL
 *   expired | suspended                                                      → BLOCKED
 *   past_due keeps FULL access + a recurring reminder for the grace window,
 *   then hard-blocks (no read-only mode).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type DateLike = Date | string | null | undefined;

interface SubLike {
  status: SubscriptionStatus;
  plan_snapshot?: {
    features?: string[];
    name?: string;
    slug?: string;
    billing_interval?: BillingInterval;
  } | null;
  current_period_end?: DateLike;
  trial_ends_at?: DateLike;
  grace_ends_at?: DateLike;
  grace_period_days_override?: number | null;
}

function toMs(d: DateLike): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

function toIso(d: DateLike): string | null {
  const t = toMs(d);
  return t == null ? null : new Date(t).toISOString();
}

/** Resolve the grace window in days: per-subscription override, else platform default. */
export function effectiveGraceDays(sub: SubLike, platformDefaultDays: number): number {
  const override = sub.grace_period_days_override;
  return typeof override === "number" && override >= 0 ? override : platformDefaultDays;
}

/**
 * Derive the *effective* status from the stored status and the clock. The stored
 * status is what the cron last materialized; this recomputes time-based drift so
 * the gate never grants access past a deadline.
 */
export function computeEffectiveStatus(
  sub: SubLike,
  now: Date,
  graceDays: number,
): SubscriptionStatus {
  const t = now.getTime();

  // Admin/terminal states are sticky — never time-promoted.
  if (sub.status === "suspended") return "suspended";
  if (sub.status === "expired") return "expired";

  if (sub.status === "trialing") {
    const trialEnd = toMs(sub.trial_ends_at);
    return trialEnd != null && t > trialEnd ? "expired" : "trialing";
  }

  if (sub.status === "canceled") {
    // Access continues until the period end, then expires.
    const periodEnd = toMs(sub.current_period_end);
    return periodEnd != null && t > periodEnd ? "expired" : "canceled";
  }

  if (sub.status === "past_due") {
    const graceEnd = toMs(sub.grace_ends_at);
    return graceEnd != null && t > graceEnd ? "expired" : "past_due";
  }

  if (sub.status === "active") {
    const periodEnd = toMs(sub.current_period_end);
    if (periodEnd == null) return "active"; // lifetime / no period → always active
    if (t <= periodEnd) return "active";
    // Period lapsed → enter the grace window lazily.
    const graceEnd = periodEnd + graceDays * DAY_MS;
    return t > graceEnd ? "expired" : "past_due";
  }

  return sub.status;
}

export function accessForStatus(effective: SubscriptionStatus): "full" | "blocked" {
  switch (effective) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
      return "full";
    default:
      return "blocked";
  }
}

function noticeForStatus(effective: SubscriptionStatus): EntitlementNotice {
  switch (effective) {
    case "trialing": return "trial";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "expired":  return "expired";
    case "suspended": return "suspended";
    default: return "none";
  }
}

function blockedMessage(effective: SubscriptionStatus): string | undefined {
  switch (effective) {
    case "expired":
      return "Your subscription has expired. Please contact your administrator to renew access.";
    case "suspended":
      return "Your account has been suspended. Please contact support.";
    default:
      return undefined;
  }
}

function uniq(keys: FeatureKey[]): FeatureKey[] {
  return Array.from(new Set(keys));
}

/**
 * Build the entitlements object the tenant app consumes. `features` always
 * includes the always-on core; gateable modules come from the frozen snapshot.
 * The status gate (`access`) is the master switch enforced in the app layout and
 * the withActiveSubscription API wrapper.
 */
export function buildEntitlements(
  sub: SubLike,
  platformDefaultGraceDays: number,
  now: Date,
): Entitlements {
  const graceDays = effectiveGraceDays(sub, platformDefaultGraceDays);
  const effective = computeEffectiveStatus(sub, now, graceDays);
  const access = accessForStatus(effective);

  const snapshotFeatures = (sub.plan_snapshot?.features ?? []) as FeatureKey[];
  const features = uniq([...ALWAYS_ON_FEATURES, ...snapshotFeatures]);

  const periodEnd = toMs(sub.current_period_end);
  const graceEndsAt =
    sub.status === "past_due"
      ? toIso(sub.grace_ends_at)
      : periodEnd != null && effective === "past_due"
        ? new Date(periodEnd + graceDays * DAY_MS).toISOString()
        : toIso(sub.grace_ends_at);

  return {
    status: sub.status,
    effectiveStatus: effective,
    access,
    notice: noticeForStatus(effective),
    message: access === "blocked" ? blockedMessage(effective) : undefined,
    trialEndsAt: toIso(sub.trial_ends_at),
    graceEndsAt,
    periodEndsAt: toIso(sub.current_period_end),
    features,
    plan: sub.plan_snapshot?.name
      ? {
          name: sub.plan_snapshot.name,
          slug: sub.plan_snapshot.slug ?? "",
          billing_interval: sub.plan_snapshot.billing_interval ?? "monthly",
        }
      : null,
  };
}

/** Entitlements for a tenant that has no subscription row at all (defensive). */
export function emptyBlockedEntitlements(): Entitlements {
  return {
    status: "expired",
    effectiveStatus: "expired",
    access: "blocked",
    notice: "expired",
    message: "No active subscription was found for this account.",
    trialEndsAt: null,
    graceEndsAt: null,
    periodEndsAt: null,
    features: [...ALWAYS_ON_FEATURES],
    plan: null,
  };
}

// ─── Transition guard (portal actions) ──────────────────────────────────────────

/** Allowed status transitions for admin/portal-driven mutations. */
export const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trialing:  ["active", "canceled", "suspended", "expired"],
  active:    ["past_due", "canceled", "suspended", "expired"],
  past_due:  ["active", "canceled", "suspended", "expired"],
  canceled:  ["active", "suspended", "expired"],
  expired:   ["active", "suspended"],
  suspended: ["active", "trialing", "past_due", "canceled", "expired"], // reactivate restores prev_status
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(from: SubscriptionStatus, to: SubscriptionStatus) {
    super(`Invalid subscription transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Compute the period end for a fresh active period given an interval + start. */
export function periodEndFor(interval: BillingInterval, start: Date): Date | null {
  if (interval === "lifetime") return null;
  const d = new Date(start);
  if (interval === "monthly") d.setMonth(d.getMonth() + 1);
  else if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
  return d;
}
