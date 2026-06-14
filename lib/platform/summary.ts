import { computeEffectiveStatus, effectiveGraceDays } from "@/lib/subscriptions/state";
import type { SubscriptionStatus } from "@/types";

export interface EffectiveSubInput {
  status: SubscriptionStatus;
  current_period_end?: Date | string | null;
  trial_ends_at?: Date | string | null;
  grace_ends_at?: Date | string | null;
  grace_period_days_override?: number | null;
}

/** Lazily derive a subscription's effective status given the platform grace default. */
export function effectiveStatusOf(
  sub: EffectiveSubInput,
  defaultGraceDays: number,
  now: Date,
): SubscriptionStatus {
  return computeEffectiveStatus(sub, now, effectiveGraceDays(sub, defaultGraceDays));
}

export function zeroStatusCounts(): Record<SubscriptionStatus, number> {
  return { trialing: 0, active: 0, past_due: 0, canceled: 0, expired: 0, suspended: 0 };
}

/** Escape a user string for safe use inside a MongoDB $regex. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
