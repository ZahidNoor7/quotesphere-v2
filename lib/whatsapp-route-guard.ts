import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { enterOrg } from "@/lib/tenant-context";
import { requireRole } from "@/lib/rbac";
import { gateFeature } from "@/lib/entitlement-guard";
import { rateLimit } from "@/lib/rate-limit";

export interface WaContext {
  session: Session;
  orgId: string;
  userId: string;
}

/**
 * Auth + tenant context + `messaging` entitlement for the manual-`enterOrg`
 * WhatsApp routes (they talk to 360dialog and can't use `withTenant`). Mirrors
 * the withTenant gates: 401 (no session/org), 403/402 (feature/subscription),
 * plus an optional RBAC check for writes and a per-org rate limit for sends.
 * Returns the principal, or a NextResponse to short-circuit the handler.
 */
export async function guardWhatsApp(
  method: string,
  opts?: { write?: boolean; rate?: { key: string; limit: number; windowMs?: number } },
): Promise<WaContext | NextResponse> {
  const session = await auth();
  const user = session?.user as { id?: string; org_id?: string } | undefined;
  if (!session || !user?.id || !user.org_id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const orgId = user.org_id;
  const userId = user.id;
  enterOrg(orgId);

  if (opts?.write) {
    const denied = requireRole(session, method);
    if (denied) return denied;
  }
  const gate = await gateFeature(orgId, "messaging");
  if (gate) return gate;

  if (opts?.rate) {
    const rl = await rateLimit(`${opts.rate.key}:${orgId}`, opts.rate.limit, opts.rate.windowMs ?? 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "You're sending messages too fast. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
  }
  return { session, orgId, userId };
}
