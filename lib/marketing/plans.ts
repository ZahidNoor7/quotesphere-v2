// Public, unauthenticated read of the GLOBAL plan catalog for the marketing page.
//
// Safety contract (see app/(marketing)/page.tsx): `Plan` is a global catalog —
// no `org_id`, no tenantScope plugin (models/Plan.ts) — so `Plan.find()` runs
// with NO tenant context and never trips the fail-closed tenant guard
// (lib/tenant-context.ts). This module therefore deliberately does NOT use
// withTenant / bypassTenant; it only ever touches non-tenant-scoped data.
//
// Scale: the read is wrapped in `unstable_cache` (revalidate 1h) so the busiest
// public surface hits MongoDB at most once per hour globally, and a static
// fallback keeps the page rendering even if the DB is unreachable.
import { unstable_cache } from "next/cache";
import { connectDB } from "@/lib/mongoose";
import Plan from "@/models/Plan";
import { getFeatureDef } from "@/lib/entitlements/features";
import type { FeatureKey, PublicPlan, PublicPlanFeature } from "@/types";

function mapFeatures(keys: readonly FeatureKey[]): PublicPlanFeature[] {
  const out: PublicPlanFeature[] = [];
  for (const key of keys) {
    const def = getFeatureDef(key);
    // Unknown / stale keys are silently dropped — keeps the public list clean.
    if (def) out.push({ key: def.key, label: def.label, description: def.description });
  }
  return out;
}

// Mirrors scripts/seed-platform-billing.mjs. Used only when the catalog is empty
// or the DB is unreachable, so the landing page always renders real-looking tiers.
const FALLBACK_PLANS: PublicPlan[] = [
  {
    slug: "free",
    name: "Free",
    description: "Get started with core quoting & invoicing.",
    billingInterval: "lifetime",
    pricePkr: 0,
    priceUsd: 0,
    features: mapFeatures(["quotations", "invoices", "customers", "services", "products"]),
    maxTeamMembers: null,
  },
  {
    slug: "basic",
    name: "Basic",
    description: "Projects, expenses, reports and payroll.",
    billingInterval: "monthly",
    pricePkr: 2500,
    priceUsd: 9,
    features: mapFeatures([
      "quotations", "invoices", "customers", "services", "products",
      "projects", "expenses", "reports", "payroll",
    ]),
    maxTeamMembers: null,
  },
  {
    slug: "premium",
    name: "Premium",
    description: "Everything, incl. AI assistant, email & WhatsApp.",
    billingInterval: "monthly",
    pricePkr: 6000,
    priceUsd: 22,
    features: mapFeatures([
      "quotations", "invoices", "customers", "services", "products",
      "projects", "expenses", "reports", "payroll",
      "messaging", "email", "ai_assistant",
    ]),
    maxTeamMembers: null,
  },
];

async function fetchPublicPlans(): Promise<PublicPlan[]> {
  try {
    await connectDB();
    // Public catalog only: active, non-grandfather (internal) plans.
    const docs = await Plan.find({ is_active: true, is_grandfather: false })
      .sort({ sort_order: 1, createdAt: 1 })
      .lean();

    if (!docs.length) return FALLBACK_PLANS;

    return docs.map((d): PublicPlan => ({
      slug: String(d.slug),
      name: String(d.name),
      description: d.description ?? "",
      billingInterval: d.billing_interval,
      pricePkr: d.price_pkr ?? 0,
      priceUsd: d.price_usd ?? 0,
      features: mapFeatures((d.features ?? []) as FeatureKey[]),
      maxTeamMembers: d.limits?.maxTeamMembers ?? null,
    }));
  } catch (err) {
    console.error("[marketing] getPublicPlans failed — serving static fallback:", err);
    return FALLBACK_PLANS;
  }
}

/**
 * Cached public plan catalog for the marketing page. Revalidates hourly so plan
 * edits in the platform portal surface within the hour without a per-request DB
 * hit. Returns a static fallback on any error (page never breaks).
 */
export const getPublicPlans = unstable_cache(fetchPublicPlans, ["marketing:public-plans:v1"], {
  revalidate: 3600,
  tags: ["public-plans"],
});
