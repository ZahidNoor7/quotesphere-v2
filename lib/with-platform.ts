import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import { withLog } from "@/lib/logger";
import { bypassTenant, runWithOrg } from "@/lib/tenant-context";

/**
 * The single, explicit PLATFORM CONTEXT — the only data-access path allowed to
 * cross tenant boundaries, used exclusively by the owner portal. It is kept
 * entirely separate from `withTenant`: it requires a platform super-admin (never
 * a tenant role), and it NEVER weakens the tenant-scoping helpers that regular
 * users rely on. Cross-tenant reads go through `platformRead` (bypass + explicit
 * filters); writes to a specific tenant go through `actOnTenant` (re-enters that
 * org's fail-closed scope so a wrong id throws instead of leaking).
 */
export interface PlatformCtx {
  session: Session;
  platformAdminId: string;
  adminEmail: string;
}

type PlatformHandler<C> = (
  req: NextRequest,
  ctx: C,
  platform: PlatformCtx,
) => Promise<NextResponse>;

export function withPlatform<C = unknown>(route: string, handler: PlatformHandler<C>) {
  return withLog(route, async (req: NextRequest, ctx: C) => {
    const session = await auth();
    const user = session?.user as
      | { isPlatformAdmin?: boolean; platformAdminId?: string; email?: string }
      | undefined;
    if (!session || !user?.isPlatformAdmin || !user.platformAdminId) {
      // 404 (not 403) — do not disclose the portal API surface to non-admins.
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    await connectDB();
    return handler(req, ctx, {
      session,
      platformAdminId: user.platformAdminId,
      adminEmail: user.email ?? "",
    });
  });
}

/**
 * Cross-tenant READ path: tenant scoping disabled. ALWAYS pair with an explicit
 * filter (or no filter for a deliberate all-tenants list). Use for portal lists
 * and aggregates that legitimately span organizations.
 */
export function platformRead<T>(fn: () => Promise<T>): Promise<T> {
  // The `await` ensures a lazily-executed Mongoose query runs INSIDE the bypass
  // context. A query merely returned (then awaited by the caller) would execute
  // after the context has unwound and lose the bypass — failing closed.
  return bypassTenant(async () => await fn());
}

/**
 * Scoped WRITE/READ against ONE tenant. Re-enters that org's tenant context so
 * the existing Mongoose plugin auto-scopes every query — a wrong/missing org id
 * fails closed rather than touching another tenant.
 */
export function actOnTenant<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return runWithOrg(orgId, async () => await fn());
}
