import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import { withLog } from "@/lib/logger";
import { runWithOrg } from "@/lib/tenant-context";
import { resolveEntitlements } from "@/lib/entitlements/resolve";
import { API_SEGMENT_FEATURE } from "@/lib/entitlements/features";

/** What every org-scoped handler receives in addition to (req, ctx). */
export interface Tenant {
  session: Session;
  userId: string;
  orgId: string;
}

type TenantHandler<C> = (req: NextRequest, ctx: C, tenant: Tenant) => Promise<NextResponse>;

/**
 * Wrap an authenticated, organization-scoped route handler. It:
 *   - logs the request (composes `withLog`),
 *   - requires a session that carries both a user id and an `org_id` (else 401),
 *   - connects to Mongo,
 *   - establishes the AsyncLocalStorage tenant context for the org,
 * so the tenant Mongoose plugin auto-scopes every query/mutation to the caller's
 * organization. Inside the handler you never write an org filter by hand and you
 * never read `org_id` from the request body — it comes only from `tenant.orgId`.
 */
export function withTenant<C = unknown>(route: string, handler: TenantHandler<C>) {
  return withLog(route, async (req: NextRequest, ctx: C) => {
    const session = await auth();
    const user = session?.user as { id?: string; org_id?: string } | undefined;
    if (!session || !user?.id || !user.org_id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const orgId = user.org_id;
    const userId = user.id;
    return runWithOrg(orgId, async () => {
      // Subscription gate (writes only — reads stay available so blocked tenants can
      // still see their data and the resolver/banners work). The status block is the
      // security boundary for inactive subscriptions; the feature check enforces plan
      // tiers. Cached resolve, so this adds ~0 cost on the hot path.
      const method = req.method.toUpperCase();
      // Skip the billing gate under test (test orgs have no subscription, and the
      // resolver's process-global cache would make seeded-sub tests flaky). The gate
      // logic is covered by the pure unit tests in test/subscription-state.test.ts.
      if (process.env.NODE_ENV !== "test" && method !== "GET" && method !== "HEAD") {
        const segment = new URL(req.url).pathname.split("/")[2];
        // Billing endpoints stay open even when blocked, so an expired tenant can
        // request a renewal / plan change from the blocking screen.
        const billingExempt = segment === "billing";
        const ent = await resolveEntitlements(orgId);
        if (ent.access === "blocked" && !billingExempt) {
          return NextResponse.json(
            { success: false, error: "Your subscription is inactive. Please contact your administrator." },
            { status: 402 },
          );
        }
        const feature = segment ? API_SEGMENT_FEATURE[segment] : undefined;
        if (feature && !ent.features.includes(feature)) {
          return NextResponse.json(
            { success: false, error: "This feature isn't included in your current plan." },
            { status: 403 },
          );
        }
      }
      return handler(req, ctx, { session, userId, orgId });
    });
  });
}
