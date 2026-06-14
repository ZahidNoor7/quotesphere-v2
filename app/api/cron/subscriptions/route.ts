/**
 * Vercel Cron — runs daily to MATERIALIZE time-based subscription transitions so
 * dashboards/reporting stay accurate (trialing→expired, active→past_due→expired,
 * canceled→expired). Access correctness never depends on this running: the
 * entitlements resolver computes effective status lazily from dates. Secured by
 * CRON_SECRET. Per-login payment reminders are handled by the in-app banner.
 *
 * Schedule (vercel.json): { "path": "/api/cron/subscriptions", "schedule": "0 1 * * *" }
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Subscription from "@/models/Subscription";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { bypassTenant, runWithOrg } from "@/lib/tenant-context";
import { computeEffectiveStatus, effectiveGraceDays } from "@/lib/subscriptions/state";
import { invalidateEntitlements } from "@/lib/entitlements/resolve";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CRON_SECRET = process.env.CRON_SECRET;
const DAY = 86_400_000;

export const GET = async (req: NextRequest) => {
  if (CRON_SECRET) {
    const authz = req.headers.get("authorization");
    if (authz !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await connectDB();
  const settings = await getPlatformSettings();
  const now = new Date();

  // Only states that can drift over time; suspended/expired are sticky.
  const subs = (await bypassTenant(async () =>
    await Subscription.find({ status: { $in: ["trialing", "active", "past_due", "canceled"] } })
      .select("org_id status current_period_end trial_ends_at grace_ends_at grace_period_days_override")
      .lean(),
  )) as any[];

  let changed = 0;
  for (const s of subs) {
    const grace = effectiveGraceDays(s, settings.default_grace_period_days);
    const eff = computeEffectiveStatus(s, now, grace);
    if (eff === s.status) continue;

    const update: Record<string, unknown> = { status: eff };
    // Stamp the grace deadline when an active period first lapses into past_due.
    if (eff === "past_due" && !s.grace_ends_at && s.current_period_end) {
      update.grace_ends_at = new Date(new Date(s.current_period_end).getTime() + grace * DAY);
    }
    await runWithOrg(String(s.org_id), async () =>
      await Subscription.updateOne({ org_id: s.org_id }, { $set: update }),
    );
    invalidateEntitlements(String(s.org_id));
    changed++;
  }

  return NextResponse.json({ success: true, scanned: subs.length, changed });
};
