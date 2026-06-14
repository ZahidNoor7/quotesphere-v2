import { describe, it, expect } from "vitest";
import { req, ctx } from "./helpers";
import { TEST_ORG_ID } from "./setup";
import Organization from "@/models/Organization";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import Plan from "@/models/Plan";
import PaymentRecord from "@/models/PaymentRecord";
import TenantInvite from "@/models/TenantInvite";
import { runWithOrg } from "@/lib/tenant-context";
import { resolveEntitlements } from "@/lib/entitlements/resolve";
import { createOrgForUser } from "@/lib/provisioning";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PLATFORM_SESSION = {
  user: { isPlatformAdmin: true, platformAdminId: "0000000000000000000000b1", email: "owner@x.com", name: "Owner" },
};

async function setAuth(session: unknown) {
  const { auth } = await import("@/auth");
  (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(session);
}
const asPlatform = () => setAuth(PLATFORM_SESSION);
const asTenant = (orgId: string) =>
  setAuth({ user: { id: "0000000000000000000000a9", email: "t@x.com", role: "admin", org_id: orgId } });

let orgSeq = 0;
async function makeOrg() {
  orgSeq += 1;
  const u = await User.create({ name: `Owner ${orgSeq}`, email: `owner${orgSeq}@ex.com`, role: "admin" });
  const org = await Organization.create({ name: `Org ${orgSeq}`, owner_user_id: u._id });
  return { orgId: String(org._id), userId: String(u._id), email: u.email as string };
}

function seedSub(orgId: string, over: Record<string, any> = {}) {
  // org_id is stamped from the runWithOrg context by the tenant plugin. The async
  // callback awaits inside the context so the query/write runs scoped (not lazily
  // executed after the context unwinds — see lib/with-platform.ts).
  return runWithOrg(orgId, async () =>
    await Subscription.create({
      status: "active",
      plan_snapshot: { name: "P", slug: "p", billing_interval: "monthly", price_pkr: 0, price_usd: 0, currency: "PKR", features: ["invoices"] },
      current_period_start: new Date(),
      current_period_end: null,
      cancel_at_period_end: false,
      ...over,
    }),
  );
}
const getSub = (orgId: string) =>
  runWithOrg(orgId, async () => await Subscription.findOne({}).lean()) as Promise<any>;
const days = (d: number) => new Date(Date.now() + d * 86_400_000);

// ─── Platform context isolation (the security boundary) ───────────────────────
describe("platform context isolation", () => {
  it("rejects a tenant session on a platform route (404, no disclosure)", async () => {
    const { GET } = await import("@/app/api/platform/overview/route");
    await asTenant("0000000000000000000000ce");
    const res = await GET(req("/api/platform/overview"), undefined as any, undefined as any);
    expect(res.status).toBe(404);
  });

  it("allows a platform session on a platform route", async () => {
    const { GET } = await import("@/app/api/platform/overview/route");
    await asPlatform();
    const res = await GET(req("/api/platform/overview"), undefined as any, undefined as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("rejects a platform admin (no org_id) on a tenant route (401)", async () => {
    const { GET } = await import("@/app/api/customers/route");
    await asPlatform();
    const res = await GET(req("/api/customers"));
    expect(res.status).toBe(401);
  });
});

// ─── Entitlements resolution ──────────────────────────────────────────────────
describe("resolveEntitlements", () => {
  it("active → full access incl. always-on + snapshot features", async () => {
    const { orgId } = await makeOrg();
    await seedSub(orgId, { status: "active", current_period_end: null });
    const ent = await resolveEntitlements(orgId, { fresh: true });
    expect(ent.access).toBe("full");
    expect(ent.features).toContain("invoices");
    expect(ent.features).toContain("settings"); // always-on
  });

  it("expired trial → blocked", async () => {
    const { orgId } = await makeOrg();
    await seedSub(orgId, { status: "trialing", trial_ends_at: days(-1), current_period_end: null });
    const ent = await resolveEntitlements(orgId, { fresh: true });
    expect(ent.access).toBe("blocked");
    expect(ent.effectiveStatus).toBe("expired");
  });

  it("no subscription → blocked (fail-safe)", async () => {
    const { orgId } = await makeOrg();
    const ent = await resolveEntitlements(orgId, { fresh: true });
    expect(ent.access).toBe("blocked");
  });
});

// ─── Signup trial seeding (provisioning chokepoint) ───────────────────────────
describe("createOrgForUser trial seed", () => {
  it("seeds a trialing subscription for a new org", async () => {
    const u = await User.create({ name: "New", email: "new-signup@ex.com", role: "admin" });
    const orgId = await createOrgForUser(String(u._id), "New's Org");
    const sub = await getSub(orgId);
    expect(sub).toBeTruthy();
    expect(sub.status).toBe("trialing");
    expect(new Date(sub.trial_ends_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("consumes a matching invite and applies its trial override", async () => {
    const email = "invited@ex.com";
    await TenantInvite.create({ email, token: "tok-abc", trial_days_override: 30, status: "pending" });
    const u = await User.create({ name: "Inv", email, role: "admin" });
    const orgId = await createOrgForUser(String(u._id), "Inv Org");
    const sub = await getSub(orgId);
    const trialDays = Math.round((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86_400_000);
    expect(trialDays).toBe(30);
    const invite = await TenantInvite.findOne({ email }).lean<any>();
    expect(invite.status).toBe("consumed");
  });
});

// ─── Platform subscription actions (audited, scoped) ──────────────────────────
describe("platform tenant actions", () => {
  it("suspends a tenant and only that tenant (cross-tenant scoping)", async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    await seedSub(a.orgId, { status: "active" });
    await seedSub(b.orgId, { status: "active" });
    const { POST } = await import("@/app/api/platform/tenants/[id]/actions/route");
    await asPlatform();
    const res = await POST(req(`/api/platform/tenants/${a.orgId}/actions`, "POST", { action: "suspend", reason: "test" }), ctx(a.orgId) as any, undefined as any);
    expect(res.status).toBe(200);
    expect((await getSub(a.orgId)).status).toBe("suspended");
    expect((await getSub(b.orgId)).status).toBe("active"); // untouched
  });

  it("mark_paid activates the subscription and records a payment", async () => {
    const a = await makeOrg();
    await seedSub(a.orgId, { status: "trialing", trial_ends_at: days(3) });
    const { POST } = await import("@/app/api/platform/tenants/[id]/actions/route");
    await asPlatform();
    const res = await POST(req(`/api/platform/tenants/${a.orgId}/actions`, "POST", { action: "mark_paid", amount: 5000, currency: "PKR" }), ctx(a.orgId) as any, undefined as any);
    expect(res.status).toBe(200);
    expect((await getSub(a.orgId)).status).toBe("active");
    const payments = await runWithOrg(a.orgId, async () => await PaymentRecord.find({}).lean()) as any[];
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(5000);
  });
});

// ─── Plan catalog management ──────────────────────────────────────────────────
describe("platform plan CRUD", () => {
  it("creates, lists and refuses to delete the grandfather plan", async () => {
    const plansRoute = await import("@/app/api/platform/plans/route");
    const planIdRoute = await import("@/app/api/platform/plans/[id]/route");
    await asPlatform();

    const created = await plansRoute.POST(
      req("/api/platform/plans", "POST", { name: "Test", slug: "test-plan", billing_interval: "monthly", price_pkr: 1000, price_usd: 5, features: ["invoices", "bogus"], is_active: true, sort_order: 5 }),
      undefined as any, undefined as any,
    );
    expect(created.status).toBe(201);
    const planId = (await created.json()).data._id;

    // unknown feature key was sanitized away
    const plan = await Plan.findById(planId).lean<any>();
    expect(plan.features).toEqual(["invoices"]);

    const grand = await Plan.create({ name: "GF", slug: "gf", billing_interval: "lifetime", is_grandfather: true });
    const del = await planIdRoute.DELETE(req(`/api/platform/plans/${grand._id}`, "DELETE"), ctx(String(grand._id)) as any, undefined as any);
    expect(del.status).toBe(409); // internal plan, cannot delete
  });
});

// ─── Tenant-initiated plan change requests ────────────────────────────────────
describe("tenant plan change requests", () => {
  it("tenant admin requests a change; owner approves it", async () => {
    await Organization.create({ _id: TEST_ORG_ID, name: "Default Org", owner_user_id: "0000000000000000000000a1" });
    // Current sub on the default-session org (TEST_ORG_ID), on the Free plan.
    await seedSub(TEST_ORG_ID, {
      plan_snapshot: { name: "Free", slug: "free", billing_interval: "lifetime", price_pkr: 0, price_usd: 0, currency: "PKR", features: ["invoices"] },
    });
    const premium = await Plan.create({ name: "Premium", slug: "premium", billing_interval: "monthly", price_pkr: 6000, price_usd: 22, features: ["invoices", "payroll"], is_active: true });

    // Tenant admin (default ADMIN_SESSION) requests the switch.
    const billing = await import("@/app/api/billing/change-request/route");
    const r1 = await billing.POST(req("/api/billing/change-request", "POST", { planId: String(premium._id) }), undefined as any, undefined as any);
    expect(r1.status).toBe(200);
    let sub = await getSub(TEST_ORG_ID);
    expect(sub.pending_change?.plan_name).toBe("Premium");
    expect(sub.pending_change?.direction).toBe("upgrade");

    // Owner approves → plan applied, request cleared.
    const actions = await import("@/app/api/platform/tenants/[id]/actions/route");
    await asPlatform();
    const r2 = await actions.POST(req(`/api/platform/tenants/${TEST_ORG_ID}/actions`, "POST", { action: "approve_change" }), ctx(TEST_ORG_ID) as any, undefined as any);
    expect(r2.status).toBe(200);
    sub = await getSub(TEST_ORG_ID);
    expect(sub.plan_snapshot.slug).toBe("premium");
    expect(sub.pending_change).toBeNull();
  });

  it("rejects a non-admin tenant", async () => {
    await seedSub(TEST_ORG_ID);
    const plan = await Plan.create({ name: "Premium", slug: "premium2", billing_interval: "monthly", price_pkr: 6000, price_usd: 22, is_active: true });
    await setAuth({ user: { id: "0000000000000000000000c2", email: "staff@x.com", role: "staff", org_id: TEST_ORG_ID } });
    const billing = await import("@/app/api/billing/change-request/route");
    const r = await billing.POST(req("/api/billing/change-request", "POST", { planId: String(plan._id) }), undefined as any, undefined as any);
    expect(r.status).toBe(403);
  });

  it("owner dismiss clears a pending request", async () => {
    await Organization.create({ _id: TEST_ORG_ID, name: "Default Org", owner_user_id: "0000000000000000000000a1" });
    await seedSub(TEST_ORG_ID, {
      pending_change: { plan_name: "X", billing_interval: "monthly", direction: "change", requested_at: new Date() },
    });
    const actions = await import("@/app/api/platform/tenants/[id]/actions/route");
    await asPlatform();
    const r = await actions.POST(req(`/api/platform/tenants/${TEST_ORG_ID}/actions`, "POST", { action: "dismiss_change" }), ctx(TEST_ORG_ID) as any, undefined as any);
    expect(r.status).toBe(200);
    expect((await getSub(TEST_ORG_ID)).pending_change).toBeNull();
  });

  it("surfaces the pending request as a column in the tenants list", async () => {
    const a = await makeOrg();
    await seedSub(a.orgId, {
      pending_change: { plan_name: "Premium", billing_interval: "monthly", direction: "upgrade", requested_at: new Date() },
    });
    const { GET } = await import("@/app/api/platform/tenants/route");
    await asPlatform();
    const res = await GET(req("/api/platform/tenants?page=1"), undefined as any, undefined as any);
    expect(res.status).toBe(200);
    const rows = (await res.json()).data as any[];
    const row = rows.find((r) => r.org_id === a.orgId);
    expect(row?.pending_request?.plan_name).toBe("Premium");
    expect(row?.pending_request?.direction).toBe("upgrade");
  });
});
