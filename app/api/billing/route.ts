import { NextResponse } from "next/server";
import { withTenant } from "@/lib/with-tenant";
import Subscription from "@/models/Subscription";
import Plan from "@/models/Plan";
import { resolveEntitlements } from "@/lib/entitlements/resolve";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tenant billing view: current subscription + effective status + the public plan
 * catalog + any pending change request. Runs inside the tenant scope (withTenant).
 */
export const GET = withTenant("GET /api/billing", async (_req, _ctx, { orgId }) => {
  try {
    const ent = await resolveEntitlements(orgId);
    const sub = (await Subscription.findOne({}).lean()) as any;
    const plans = await Plan.find({ is_active: true, is_grandfather: false })
      .sort({ sort_order: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        status: ent.status,
        effectiveStatus: ent.effectiveStatus,
        notice: ent.notice,
        plan_snapshot: sub?.plan_snapshot ?? null,
        trial_ends_at: ent.trialEndsAt,
        current_period_end: ent.periodEndsAt,
        features: ent.features,
        pending_change: sub?.pending_change ?? null,
        plans,
      },
    });
  } catch (err) {
    console.error("[billing GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load billing" }, { status: 500 });
  }
});
