import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Organization from "@/models/Organization";
import Subscription from "@/models/Subscription";
import Plan from "@/models/Plan";
import TenantInvite from "@/models/TenantInvite";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { runWithOrg } from "@/lib/tenant-context";
import { sanitizeFeatureKeys, GATEABLE_FEATURE_KEYS } from "@/lib/entitlements/features";
import type { BillingInterval, BillingCurrency } from "@/types";

/**
 * Create a new organization owned by `userId` and link the user to it.
 * Returns the new org id as a string. `User` and `Organization` are NOT
 * tenant-scoped, so this is safe to call outside any tenant context.
 *
 * Also seeds the tenant's trial subscription (best-effort — see below).
 */
export async function createOrgForUser(userId: string, name: string): Promise<string> {
  let org;
  try {
    org = await Organization.create({ name, owner_user_id: userId });
  } catch (err) {
    // Concurrent first-login race: the unique index on owner_user_id rejects the
    // second create — reuse the org the winner already made instead of spawning a
    // duplicate org + trial subscription.
    if ((err as { code?: number })?.code === 11000) {
      const existing = await Organization.findOne({ owner_user_id: userId });
      if (existing) {
        await User.updateOne(
          { _id: userId, $or: [{ org_id: null }, { org_id: { $exists: false } }] },
          { $set: { org_id: existing._id } },
        );
        return String(existing._id);
      }
    }
    throw err;
  }
  // Only claim the user if they don't already point at an org (idempotent).
  await User.updateOne(
    { _id: userId, $or: [{ org_id: null }, { org_id: { $exists: false } }] },
    { $set: { org_id: org._id } },
  );
  await seedTrialSubscription(String(org._id), userId);
  return String(org._id);
}

/**
 * Ensure a user has an organization, creating one on first need. Used to
 * bootstrap OAuth users (who are created by the Auth.js adapter and never hit
 * the credentials register route). Idempotent: returns the existing org if set.
 */
export async function ensureUserOrg(
  userId: string,
  displayName?: string | null,
): Promise<string | undefined> {
  await connectDB();
  const user = await User.findById(userId)
    .select("org_id name email")
    .lean<{ org_id?: mongoose.Types.ObjectId; name?: string; email?: string } | null>();
  if (!user) return undefined;
  if (user.org_id) return String(user.org_id);
  const base = displayName || user.name || user.email || "My";
  return createOrgForUser(userId, `${base}'s Organization`);
}

interface TrialSnapshot {
  name: string; slug: string; billing_interval: BillingInterval;
  price_pkr: number; price_usd: number; currency: BillingCurrency; features: string[];
}

/**
 * Give a brand-new tenant a `trialing` subscription using the platform default
 * trial length — or a TenantInvite's overrides if one was pre-created for this
 * email. Idempotent and fully fail-safe: a billing-seed error never blocks signup.
 */
async function seedTrialSubscription(orgId: string, userId: string): Promise<void> {
  try {
    await connectDB();
    // Never create a second subscription for an org.
    const exists = await runWithOrg(orgId, async () =>
      await Subscription.findOne({ org_id: orgId }).select("_id").lean(),
    );
    if (exists) return;

    const settings = await getPlatformSettings();
    const currency = settings.default_currency;
    let trialDays = settings.default_trial_days;

    // Default: a full-featured trial so new tenants experience the whole product.
    let snapshot: TrialSnapshot = {
      name: "Free Trial", slug: "trial", billing_interval: "monthly",
      price_pkr: 0, price_usd: 0, currency, features: [...GATEABLE_FEATURE_KEYS],
    };
    let planId: mongoose.Types.ObjectId | undefined;

    const user = await User.findById(userId).select("email").lean<{ email?: string } | null>();
    const email = user?.email?.toLowerCase();
    if (email) {
      const candidate = await TenantInvite.findOne({
        email,
        status: "pending",
        $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
      }).sort({ createdAt: -1 });
      // Atomically claim the invite — only the request that flips it from
      // `pending` proceeds, so the same single-use invite can't be consumed by
      // two concurrent signups (entitlement / trial abuse).
      const invite = candidate
        ? await TenantInvite.findOneAndUpdate(
            { _id: candidate._id, status: "pending" },
            { $set: { status: "consumed", consumed_by_org_id: new mongoose.Types.ObjectId(orgId), consumed_at: new Date() } },
            { returnDocument: "after" },
          )
        : null;
      if (invite) {
        if (invite.trial_days_override != null) trialDays = invite.trial_days_override;
        if (invite.plan_id_override) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const plan = await Plan.findById(invite.plan_id_override).lean<any>();
          if (plan) {
            planId = plan._id;
            snapshot = {
              name: plan.name, slug: plan.slug, billing_interval: plan.billing_interval,
              price_pkr: plan.price_pkr, price_usd: plan.price_usd, currency,
              features: sanitizeFeatureKeys(plan.features),
            };
          }
        }
      }
    }

    const now = new Date();
    const trialEnds = new Date(now.getTime() + trialDays * 86400000);
    await runWithOrg(orgId, async () =>
      await Subscription.create({
        plan_id: planId,
        status: "trialing",
        plan_snapshot: snapshot,
        current_period_start: now,
        current_period_end: null,
        trial_ends_at: trialEnds,
        cancel_at_period_end: false,
      }),
    );
  } catch (err) {
    console.error("[provisioning] trial subscription seed failed:", err);
  }
}
