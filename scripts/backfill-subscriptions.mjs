#!/usr/bin/env node
/**
 * Backfill: give every EXISTING organization an `active`, no-expiry subscription on
 * the hidden "grandfathered" plan, so enabling enforcement never locks out current
 * tenants. Idempotent — orgs that already have a subscription are skipped (unique
 * org_id + $setOnInsert).
 *
 *   node scripts/seed-platform-billing.mjs --yes   # run this FIRST (creates the plan)
 *   node scripts/backfill-subscriptions.mjs --yes
 */
import { connect, mongoose, confirmed } from "./_db.mjs";

const db = await connect();

const plan = await db.collection("plans").findOne({ slug: "grandfathered" });
if (!plan) {
  console.error("✖ 'grandfathered' plan not found. Run scripts/seed-platform-billing.mjs --yes first.");
  await mongoose.disconnect();
  process.exit(2);
}

const settings = await db.collection("platformsettings").findOne({ key: "global" });
const currency = settings?.default_currency === "USD" ? "USD" : "PKR";

const orgs = await db.collection("organizations").find({}, { projection: { _id: 1, name: 1 } }).toArray();
const subCol = db.collection("subscriptions");
const existingOrgIds = new Set(
  (await subCol.find({}, { projection: { org_id: 1 } }).toArray()).map((s) => String(s.org_id)),
);
const missing = orgs.filter((o) => !existingOrgIds.has(String(o._id)));

if (!confirmed()) {
  console.log(`DRY RUN — ${orgs.length} orgs total, ${existingOrgIds.size} already subscribed, ${missing.length} to backfill.`);
  console.log("Each missing org → active 'Grandfathered' subscription (all features, no expiry).");
  console.log("Re-run with --yes (or CONFIRM=yes) to apply.");
  await mongoose.disconnect();
  process.exit(0);
}

if (missing.length === 0) {
  console.log("✓ Nothing to backfill — every org already has a subscription.");
  await mongoose.disconnect();
  process.exit(0);
}

const now = new Date();
const snapshot = {
  plan_id: plan._id,
  name: plan.name,
  slug: plan.slug,
  billing_interval: plan.billing_interval,
  price_pkr: plan.price_pkr,
  price_usd: plan.price_usd,
  currency,
  features: plan.features,
};

const ops = missing.map((o) => ({
  updateOne: {
    filter: { org_id: o._id },
    update: {
      $setOnInsert: {
        org_id: o._id,
        plan_id: plan._id,
        status: "active",
        plan_snapshot: snapshot,
        current_period_start: now,
        current_period_end: null, // lifetime / no expiry → stays active
        trial_ends_at: null,
        grace_period_days_override: null,
        grace_ends_at: null,
        canceled_at: null,
        cancel_at_period_end: false,
        suspended_at: null,
        suspended_reason: "",
        prev_status: null,
        createdAt: now,
        updatedAt: now,
      },
    },
    upsert: true,
  },
}));

const res = await subCol.bulkWrite(ops, { ordered: false });
console.log(`✓ Backfilled ${res.upsertedCount} subscriptions (${missing.length} orgs were missing one).`);

await mongoose.disconnect();
