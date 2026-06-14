import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/payments/provider";

/**
 * Payment-gateway webhook endpoint — STUB (design only this pass). Lives under
 * /api/webhooks/* so it is reachable without a session (the proxy excludes that
 * path) once a real provider is wired.
 *
 * When implementing a live provider:
 *   1. read the RAW body (needed for signature verification),
 *   2. `provider.verifyAndParseWebhook(req, rawBody)` — reject on bad signature,
 *   3. map the event → PaymentRecord (idempotent on provider_ref) + a Subscription
 *      transition, using bypassTenant()/runWithOrg(orgId) so writes stay scoped,
 *   4. invalidateEntitlements(orgId).
 */
export const POST = async (
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) => {
  const { provider } = await params;
  const impl = getProvider(provider);
  if (!impl || provider === "manual") {
    return NextResponse.json({ error: "No live payment provider configured." }, { status: 501 });
  }
  // Not implemented in this pass — a real provider would verify + process here.
  return NextResponse.json({ error: "Webhook handling not implemented yet." }, { status: 501 });
};
