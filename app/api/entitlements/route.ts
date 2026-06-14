import { NextResponse } from "next/server";
import { withTenant } from "@/lib/with-tenant";
import { resolveEntitlements } from "@/lib/entitlements/resolve";

/** Current tenant's effective entitlements — drives the sidebar, banners and module guards. */
export const GET = withTenant("GET /api/entitlements", async (_req, _ctx, { orgId }) => {
  const ent = await resolveEntitlements(orgId);
  return NextResponse.json({ success: true, data: ent });
});
