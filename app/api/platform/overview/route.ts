import { NextResponse } from "next/server";
import { withPlatform, platformRead } from "@/lib/with-platform";
import Subscription from "@/models/Subscription";
import PaymentRecord from "@/models/PaymentRecord";
import Organization from "@/models/Organization";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { effectiveStatusOf, zeroStatusCounts } from "@/lib/platform/summary";
import type { PlatformTenantSummary, SubscriptionStatus } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GET = withPlatform("GET /api/platform/overview", async () => {
  try {
    const settings = await getPlatformSettings();
    const grace = settings.default_grace_period_days;
    const now = new Date();
    const soonCutoff = now.getTime() + 7 * 24 * 60 * 60 * 1000;

    const [subs, revenueAgg] = await Promise.all([
      platformRead(() =>
        Subscription.find(
          {},
          {
            org_id: 1, status: 1, trial_ends_at: 1, current_period_end: 1,
            grace_ends_at: 1, grace_period_days_override: 1, "plan_snapshot.name": 1,
          },
        ).lean(),
      ),
      platformRead(() =>
        PaymentRecord.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: "$currency", total: { $sum: "$amount" } } },
        ]),
      ),
    ]);

    const counts = zeroStatusCounts();
    const expiring: any[] = [];
    for (const s of subs as any[]) {
      const eff = effectiveStatusOf(s, grace, now);
      counts[eff] += 1;
      if (eff === "trialing" && s.trial_ends_at && new Date(s.trial_ends_at).getTime() <= soonCutoff) {
        expiring.push(s);
      }
    }
    expiring.sort((a, b) => new Date(a.trial_ends_at).getTime() - new Date(b.trial_ends_at).getTime());
    const top = expiring.slice(0, 8);

    const orgs = top.length
      ? ((await platformRead(() =>
          Organization.find({ _id: { $in: top.map((t) => t.org_id) } }, { name: 1 }).lean(),
        )) as any[])
      : [];
    const orgName = new Map(orgs.map((o) => [String(o._id), o.name as string]));

    const trialsExpiringSoon: PlatformTenantSummary[] = top.map((s) => ({
      org_id: String(s.org_id),
      org_name: orgName.get(String(s.org_id)) ?? "—",
      created_at: "",
      status: s.status as SubscriptionStatus,
      effectiveStatus: effectiveStatusOf(s, grace, now),
      plan_name: s.plan_snapshot?.name,
      trial_ends_at: s.trial_ends_at ? new Date(s.trial_ends_at).toISOString() : null,
      current_period_end: s.current_period_end ? new Date(s.current_period_end).toISOString() : null,
    }));

    const revenue = (revenueAgg as any[])
      .filter((r) => r._id === "PKR" || r._id === "USD")
      .map((r) => ({ currency: r._id, total: r.total }));

    return NextResponse.json({
      success: true,
      data: { counts: { ...counts, total: (subs as any[]).length }, revenue, trialsExpiringSoon },
    });
  } catch (err) {
    console.error("[platform/overview GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load overview" }, { status: 500 });
  }
});
