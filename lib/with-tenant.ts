import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import { withLog } from "@/lib/logger";
import { runWithOrg } from "@/lib/tenant-context";

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
    return runWithOrg(orgId, () => handler(req, ctx, { session, userId, orgId }));
  });
}
