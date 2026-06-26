import { NextResponse } from "next/server";
import { resolveEntitlements } from "@/lib/entitlements/resolve";
import type { FeatureKey } from "@/types";

/**
 * Inline entitlement gate for routes that can't use `withTenant` (streaming SSE
 * handlers, manual `enterOrg` flows). Mirrors the gate in lib/with-tenant.ts:
 *   - 402 when the subscription is blocked (expired / suspended)
 *   - 403 when the plan doesn't include `feature`
 * Returns the response to send, or null to proceed. Skipped under test (parity
 * with withTenant, whose billing gate is also test-skipped).
 */
export async function gateFeature(orgId: string, feature?: FeatureKey): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "test") return null;
  const ent = await resolveEntitlements(orgId);
  if (ent.access === "blocked") {
    return NextResponse.json(
      { success: false, error: "Your subscription is inactive. Please contact your administrator." },
      { status: 402 },
    );
  }
  if (feature && !ent.features.includes(feature)) {
    return NextResponse.json(
      { success: false, error: "This feature isn't included in your current plan." },
      { status: 403 },
    );
  }
  return null;
}
