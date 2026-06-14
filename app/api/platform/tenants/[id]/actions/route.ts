import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withPlatform, platformRead, actOnTenant } from "@/lib/with-platform";
import { recordPlatformAudit } from "@/lib/platform-audit";
import Organization from "@/models/Organization";
import Subscription from "@/models/Subscription";
import PaymentRecord from "@/models/PaymentRecord";
import Plan from "@/models/Plan";
import { assertTransition, InvalidTransitionError, periodEndFor } from "@/lib/subscriptions/state";
import { sanitizeFeatureKeys } from "@/lib/entitlements/features";
import { invalidateEntitlements } from "@/lib/entitlements/resolve";
import type { BillingCurrency, BillingInterval } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const currencyEnum = z.enum(["PKR", "USD"]);

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_plan"), planId: z.string(), currency: currencyEnum.optional() }),
  z.object({
    action: z.literal("set_trial"),
    trialDays: z.coerce.number().int().min(0).max(3650).optional(),
    trialEndsAt: z.string().optional(),
  }),
  z.object({
    action: z.literal("mark_paid"),
    amount: z.coerce.number().min(0),
    currency: currencyEnum,
    planId: z.string().optional(),
    note: z.string().max(500).optional(),
    providerRef: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("suspend"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("reactivate") }),
  z.object({ action: z.literal("cancel"), atPeriodEnd: z.boolean().default(true) }),
  z.object({ action: z.literal("set_grace"), graceDays: z.coerce.number().int().min(0).max(90).nullable() }),
  z.object({ action: z.literal("approve_change") }),
  z.object({ action: z.literal("dismiss_change") }),
]);

function snapshotFromPlan(plan: any, currency: BillingCurrency) {
  return {
    plan_id: plan._id,
    name: plan.name,
    slug: plan.slug,
    billing_interval: plan.billing_interval as BillingInterval,
    price_pkr: plan.price_pkr,
    price_usd: plan.price_usd,
    currency,
    features: sanitizeFeatureKeys(plan.features),
  };
}

export const POST = withPlatform(
  "POST /api/platform/tenants/[id]/actions",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, platform) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) {
        return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      }
      const parsed = actionSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: z.flattenError(parsed.error).fieldErrors },
          { status: 400 },
        );
      }
      const action = parsed.data;

      const org = (await platformRead(() => Organization.findById(id).lean())) as any;
      if (!org) return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });

      const now = new Date();

      // All subscription/payment work runs INSIDE this tenant's scope (fail-closed).
      const outcome = await actOnTenant(id, async () => {
        const sub = await Subscription.findOne({ org_id: id });
        if (!sub) return { error: "no_subscription" as const };
        const before = sub.toObject();

        switch (action.action) {
          case "change_plan": {
            const plan = (await Plan.findById(action.planId).lean()) as any;
            if (!plan) return { error: "plan_not_found" as const };
            const currency = (action.currency ?? sub.plan_snapshot?.currency ?? "PKR") as BillingCurrency;
            sub.plan_id = plan._id;
            sub.plan_snapshot = snapshotFromPlan(plan, currency) as any;
            // Proration on mid-cycle change is intentionally deferred (out of scope).
            break;
          }
          case "set_trial": {
            if (action.trialDays == null && !action.trialEndsAt) {
              return { error: "trial_input" as const };
            }
            let end: Date;
            if (action.trialEndsAt) {
              end = new Date(action.trialEndsAt);
              if (Number.isNaN(end.getTime())) return { error: "trial_input" as const };
            } else {
              end = new Date(now.getTime() + (action.trialDays ?? 0) * 86400000);
            }
            assertTransition(sub.status, "trialing");
            sub.status = "trialing";
            sub.trial_ends_at = end;
            sub.grace_ends_at = null;
            sub.suspended_at = null;
            sub.suspended_reason = "";
            sub.canceled_at = null;
            sub.cancel_at_period_end = false;
            sub.prev_status = null;
            break;
          }
          case "mark_paid": {
            let interval: BillingInterval = sub.plan_snapshot?.billing_interval ?? "monthly";
            if (action.planId) {
              const plan = (await Plan.findById(action.planId).lean()) as any;
              if (!plan) return { error: "plan_not_found" as const };
              sub.plan_id = plan._id;
              sub.plan_snapshot = snapshotFromPlan(plan, action.currency) as any;
              interval = plan.billing_interval;
            }
            assertTransition(sub.status, "active");
            sub.status = "active";
            sub.current_period_start = now;
            sub.current_period_end = periodEndFor(interval, now);
            sub.grace_ends_at = null;
            sub.suspended_at = null;
            sub.suspended_reason = "";
            sub.canceled_at = null;
            sub.cancel_at_period_end = false;
            sub.prev_status = null;
            await PaymentRecord.create({
              subscription_id: sub._id,
              amount: action.amount,
              currency: action.currency,
              status: "paid",
              method: "manual",
              provider: null,
              provider_ref: action.providerRef ?? null,
              description: action.note ?? "Manual payment",
              plan_slug: sub.plan_snapshot?.slug ?? "",
              recorded_by_type: "platform",
              recorded_by_id: platform.platformAdminId,
              paid_at: now,
            });
            break;
          }
          case "suspend": {
            if (sub.status !== "suspended") sub.prev_status = sub.status;
            assertTransition(sub.status, "suspended");
            sub.status = "suspended";
            sub.suspended_at = now;
            sub.suspended_reason = action.reason ?? "";
            break;
          }
          case "reactivate": {
            const target =
              sub.prev_status && sub.prev_status !== "suspended" ? sub.prev_status : "active";
            sub.status = target;
            sub.suspended_at = null;
            sub.suspended_reason = "";
            sub.prev_status = null;
            break;
          }
          case "cancel": {
            if (action.atPeriodEnd && sub.current_period_end) {
              assertTransition(sub.status, "canceled");
              sub.status = "canceled";
              sub.cancel_at_period_end = true;
              sub.canceled_at = now;
            } else {
              assertTransition(sub.status, "expired");
              sub.status = "expired";
              sub.cancel_at_period_end = false;
              sub.canceled_at = now;
            }
            break;
          }
          case "set_grace": {
            sub.grace_period_days_override = action.graceDays;
            break;
          }
          case "approve_change": {
            const pc = sub.pending_change;
            if (!pc || !pc.plan_id) return { error: "no_pending" as const };
            const plan = (await Plan.findById(pc.plan_id).lean()) as any;
            if (!plan) return { error: "plan_not_found" as const };
            const currency = (sub.plan_snapshot?.currency ?? "PKR") as BillingCurrency;
            sub.plan_id = plan._id;
            sub.plan_snapshot = snapshotFromPlan(plan, currency) as any;
            // Applies the requested plan + features now; the owner records payment
            // separately via "Mark paid" if a charge is due.
            sub.pending_change = null;
            break;
          }
          case "dismiss_change": {
            sub.pending_change = null;
            break;
          }
        }

        await sub.save();
        return { sub, before, after: sub.toObject() };
      });

      if ("error" in outcome) {
        const errMap: Record<string, [string, number]> = {
          no_subscription: ["This tenant has no subscription", 404],
          plan_not_found: ["Plan not found", 400],
          trial_input: ["Provide trialDays or a valid trialEndsAt", 400],
          no_pending: ["No pending change request", 400],
        };
        const [msg, code] = errMap[outcome.error as string] ?? ["Action failed", 400];
        return NextResponse.json({ success: false, error: msg }, { status: code });
      }

      await recordPlatformAudit({
        req,
        platformAdminId: platform.platformAdminId,
        actorEmail: platform.adminEmail,
        action: `subscription.${action.action}`,
        targetOrgId: id,
        targetOrgName: org.name,
        before: outcome.before,
        after: outcome.after,
      });

      // Reflect the change in the tenant's gate promptly (same-instance cache).
      invalidateEntitlements(id);

      return NextResponse.json({ success: true, data: outcome.sub });
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
      console.error("[platform/tenants/[id]/actions POST]", err);
      return NextResponse.json({ success: false, error: "Action failed" }, { status: 500 });
    }
  },
);
