import { describe, it, expect } from "vitest";
import {
  computeEffectiveStatus,
  accessForStatus,
  buildEntitlements,
  canTransition,
  periodEndFor,
  effectiveGraceDays,
} from "@/lib/subscriptions/state";
import {
  featureForRoute,
  sanitizeFeatureKeys,
  ALWAYS_ON_FEATURES,
} from "@/lib/entitlements/features";
import type { SubscriptionStatus } from "@/types";

const now = new Date("2026-06-13T00:00:00.000Z");
const days = (d: number) => new Date(now.getTime() + d * 86_400_000);
const sub = (s: Partial<{ status: SubscriptionStatus } & Record<string, unknown>>) =>
  ({ status: "active", ...s } as any);

describe("computeEffectiveStatus", () => {
  it("trialing stays trialing inside the window, expires after", () => {
    expect(computeEffectiveStatus(sub({ status: "trialing", trial_ends_at: days(5) }), now, 7)).toBe("trialing");
    expect(computeEffectiveStatus(sub({ status: "trialing", trial_ends_at: days(-2) }), now, 7)).toBe("expired");
  });

  it("active with no period end (lifetime) stays active", () => {
    expect(computeEffectiveStatus(sub({ status: "active", current_period_end: null }), now, 7)).toBe("active");
  });

  it("active lapses into past_due within grace, then expired", () => {
    expect(computeEffectiveStatus(sub({ status: "active", current_period_end: days(-2) }), now, 7)).toBe("past_due");
    expect(computeEffectiveStatus(sub({ status: "active", current_period_end: days(-10) }), now, 7)).toBe("expired");
  });

  it("past_due respects grace_ends_at", () => {
    expect(computeEffectiveStatus(sub({ status: "past_due", grace_ends_at: days(3) }), now, 7)).toBe("past_due");
    expect(computeEffectiveStatus(sub({ status: "past_due", grace_ends_at: days(-1) }), now, 7)).toBe("expired");
  });

  it("canceled keeps access until period end, then expires", () => {
    expect(computeEffectiveStatus(sub({ status: "canceled", current_period_end: days(5) }), now, 7)).toBe("canceled");
    expect(computeEffectiveStatus(sub({ status: "canceled", current_period_end: days(-1) }), now, 7)).toBe("expired");
  });

  it("suspended and expired are sticky", () => {
    expect(computeEffectiveStatus(sub({ status: "suspended" }), now, 7)).toBe("suspended");
    expect(computeEffectiveStatus(sub({ status: "expired" }), now, 7)).toBe("expired");
  });

  it("per-tenant grace override beats the platform default", () => {
    const lapsed = sub({ status: "active", current_period_end: days(-2), grace_period_days_override: 1 });
    expect(effectiveGraceDays(lapsed, 7)).toBe(1);
    // 2 days lapsed > 1-day grace → expired
    expect(computeEffectiveStatus(lapsed, now, effectiveGraceDays(lapsed, 7))).toBe("expired");
  });
});

describe("accessForStatus", () => {
  it("grants full access to trialing/active/past_due/canceled, blocks the rest", () => {
    expect(accessForStatus("trialing")).toBe("full");
    expect(accessForStatus("active")).toBe("full");
    expect(accessForStatus("past_due")).toBe("full");
    expect(accessForStatus("canceled")).toBe("full");
    expect(accessForStatus("expired")).toBe("blocked");
    expect(accessForStatus("suspended")).toBe("blocked");
  });
});

describe("buildEntitlements", () => {
  it("merges always-on with snapshot features when active", () => {
    const ent = buildEntitlements(
      sub({ status: "active", current_period_end: null, plan_snapshot: { name: "Premium", slug: "premium", billing_interval: "monthly", features: ["invoices", "payroll"] } }),
      7, now,
    );
    expect(ent.access).toBe("full");
    expect(ent.notice).toBe("none");
    expect(ent.features).toContain("invoices");
    expect(ent.features).toContain("payroll");
    for (const k of ALWAYS_ON_FEATURES) expect(ent.features).toContain(k);
    expect(ent.plan?.name).toBe("Premium");
  });

  it("flags a trial with the trial notice", () => {
    const ent = buildEntitlements(sub({ status: "trialing", trial_ends_at: days(3) }), 7, now);
    expect(ent.notice).toBe("trial");
    expect(ent.access).toBe("full");
  });

  it("blocks a suspended tenant", () => {
    const ent = buildEntitlements(sub({ status: "suspended" }), 7, now);
    expect(ent.access).toBe("blocked");
    expect(ent.notice).toBe("suspended");
  });
});

describe("transition guard", () => {
  it("allows valid transitions and rejects invalid ones", () => {
    expect(canTransition("active", "past_due")).toBe(true);
    expect(canTransition("past_due", "active")).toBe(true);
    expect(canTransition("suspended", "active")).toBe(true);
    expect(canTransition("active", "trialing")).toBe(false);
    expect(canTransition("expired", "past_due")).toBe(false);
  });
});

describe("periodEndFor", () => {
  it("computes monthly/annual periods and leaves lifetime open", () => {
    expect(periodEndFor("lifetime", now)).toBeNull();
    expect(periodEndFor("monthly", now)!.getUTCMonth()).toBe(6); // June (5) → July (6)
    expect(periodEndFor("annual", now)!.getUTCFullYear()).toBe(2027);
  });
});

describe("feature registry", () => {
  it("maps routes to features", () => {
    expect(featureForRoute("/invoices")).toBe("invoices");
    expect(featureForRoute("/invoices/abc123")).toBe("invoices");
    expect(featureForRoute("/assistant")).toBe("ai_assistant");
    expect(featureForRoute("/nope")).toBeNull();
  });

  it("sanitizes feature lists to known gateable keys only", () => {
    // "settings" is always-on (not gateable), "bogus" is unknown → both dropped.
    expect(sanitizeFeatureKeys(["invoices", "bogus", "settings", "invoices"])).toEqual(["invoices"]);
    expect(sanitizeFeatureKeys("not-an-array" as unknown)).toEqual([]);
  });
});
