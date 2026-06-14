#!/usr/bin/env node
/**
 * Seed the global PlatformSettings singleton + the starter Plan catalog.
 * Idempotent: each plan is upserted by slug with $setOnInsert, so re-running never
 * clobbers edits the owner later made in the portal. The hidden "grandfathered"
 * plan backs the backfill of pre-billing tenants.
 *
 *   node scripts/seed-platform-billing.mjs --yes
 *
 * Feature sets below are EXAMPLES matching the requested tiers — confirm/edit
 * before applying, then fine-tune in the portal.
 */
import { connect, mongoose, confirmed } from "./_db.mjs";

const FREE_FEATURES = ["quotations", "invoices", "customers", "services", "products"];
const BASIC_FEATURES = [...FREE_FEATURES, "projects", "expenses", "reports", "payroll"];
const PREMIUM_FEATURES = [...BASIC_FEATURES, "messaging", "email", "ai_assistant"];
const ALL_FEATURES = PREMIUM_FEATURES;

const PLANS = [
  { name: "Free", slug: "free", description: "Get started with core quoting & invoicing.",
    billing_interval: "lifetime", price_pkr: 0, price_usd: 0, features: FREE_FEATURES,
    is_active: true, is_grandfather: false, sort_order: 1 },
  { name: "Basic", slug: "basic", description: "Projects, expenses, reports and payroll.",
    billing_interval: "monthly", price_pkr: 2500, price_usd: 9, features: BASIC_FEATURES,
    is_active: true, is_grandfather: false, sort_order: 2 },
  { name: "Premium", slug: "premium", description: "Everything, incl. AI assistant, email & WhatsApp.",
    billing_interval: "monthly", price_pkr: 6000, price_usd: 22, features: PREMIUM_FEATURES,
    is_active: true, is_grandfather: false, sort_order: 3 },
  // Hidden internal plan used to grandfather existing tenants to full access.
  { name: "Grandfathered", slug: "grandfathered", description: "Internal — full access for legacy tenants.",
    billing_interval: "lifetime", price_pkr: 0, price_usd: 0, features: ALL_FEATURES,
    is_active: false, is_grandfather: true, sort_order: 99 },
];

const db = await connect();

if (!confirmed()) {
  console.log("DRY RUN — would seed PlatformSettings(default_trial_days=14, default_grace_period_days=7) and plans:");
  for (const p of PLANS) console.log(`  • ${p.name} (${p.slug}) — ${p.features.length} features`);
  console.log("Re-run with --yes (or CONFIRM=yes) to apply.");
  await mongoose.disconnect();
  process.exit(0);
}

const now = new Date();

// PlatformSettings singleton
await db.collection("platformsettings").updateOne(
  { key: "global" },
  {
    $setOnInsert: {
      key: "global", default_trial_days: 14, default_grace_period_days: 7,
      default_currency: "PKR", createdAt: now, updatedAt: now,
    },
  },
  { upsert: true },
);
console.log("✓ PlatformSettings ensured (trial 14d, grace 7d).");

// Plan catalog
for (const p of PLANS) {
  await db.collection("plans").updateOne(
    { slug: p.slug },
    { $setOnInsert: { ...p, limits: {}, createdAt: now, updatedAt: now } },
    { upsert: true },
  );
  console.log(`✓ Plan ensured: ${p.name} (${p.slug})`);
}

await mongoose.disconnect();
console.log("Done. Edit plans & pricing in the platform portal as needed.");
