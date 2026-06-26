import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";
import Subscription from "@/models/Subscription";
import Plan from "@/models/Plan";

/* eslint-disable @typescript-eslint/no-explicit-any */

const schema = z.object({ planId: z.string(), note: z.string().max(300).optional() });

/** Tenant (admin) requests a plan change. Stored as a pending request for the
 *  platform owner to approve/dismiss — nothing changes until then. */
export const POST = withTenant("POST /api/billing/change-request", async (req: NextRequest, _ctx, { session, userId }) => {
  try {
    if (session.user?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Only an organization admin can change the plan." }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    if (!isValidObjectId(parsed.data.planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan." }, { status: 400 });
    }
    const plan = (await Plan.findById(parsed.data.planId).lean()) as any;
    if (!plan || !plan.is_active || plan.is_grandfather) {
      return NextResponse.json({ success: false, error: "That plan isn't available." }, { status: 400 });
    }
    const sub = await Subscription.findOne({});
    if (!sub) {
      return NextResponse.json({ success: false, error: "No subscription found." }, { status: 404 });
    }
    // Re-requesting the current plan is allowed — it's a renewal request (the UI only
    // surfaces that path when the subscription is expired).

    const currentPrice = sub.plan_snapshot?.price_pkr ?? 0;
    const direction =
      plan.price_pkr > currentPrice ? "upgrade" : plan.price_pkr < currentPrice ? "downgrade" : "change";

    sub.pending_change = {
      plan_id: plan._id,
      plan_name: plan.name,
      billing_interval: plan.billing_interval,
      direction,
      note: parsed.data.note ?? "",
      requested_by_user_id: userId,
      requested_at: new Date(),
    };
    await sub.save();

    void recordAudit({
      req, session, action: "update", resource: "settings", resource_id: String(sub._id),
      resource_label: `Plan change requested: ${plan.name} (${direction})`,
      after: { plan_name: plan.name, direction },
    });
    return NextResponse.json({ success: true, data: sub.pending_change });
  } catch (err) {
    console.error("[billing change-request POST]", err);
    return NextResponse.json({ success: false, error: "Failed to submit request" }, { status: 500 });
  }
});

/** Tenant (admin) cancels their pending change request. */
export const DELETE = withTenant("DELETE /api/billing/change-request", async (req, _ctx, { session }) => {
  try {
    if (session.user?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Only an organization admin can change the plan." }, { status: 403 });
    }
    const sub = await Subscription.findOne({});
    if (!sub) {
      return NextResponse.json({ success: false, error: "No subscription found." }, { status: 404 });
    }
    sub.pending_change = null;
    await sub.save();
    void recordAudit({ req, session, action: "update", resource: "settings", resource_id: String(sub._id), resource_label: "Plan change request cancelled" });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[billing change-request DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to cancel request" }, { status: 500 });
  }
});
