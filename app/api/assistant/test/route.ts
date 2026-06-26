import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import type { AiAssistantConfig } from "@/types";
import { resolveProvider } from "@/lib/assistant/providers";
import { enterOrg } from "@/lib/tenant-context";
import { gateFeature } from "@/lib/entitlement-guard";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify the saved AI provider config by making one minimal streamed call. */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "anon";
  const orgId = (session.user as { org_id?: string }).org_id;
  if (!orgId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  enterOrg(orgId);

  const rl = await rateLimit(`ai:test:${userId}`, 10, 60_000);
  if (!rl.success) return NextResponse.json({ success: false, error: "Too many requests — please wait a moment." }, { status: 429 });
  const gate = await gateFeature(orgId, "ai_assistant");
  if (gate) return gate;

  await connectDB();
  const settings = (await Settings.findOne({}).lean()) as
    | { integrations?: { aiAssistant?: AiAssistantConfig } }
    | null;
  const cfg = settings?.integrations?.aiAssistant;

  const ac = new AbortController();
  try {
    const provider = resolveProvider(cfg);
    for await (const ev of provider.streamChat({
      system: "Connection test. Reply with the single word OK.",
      messages: [{ id: "ping", role: "user", content: "ping", createdAt: new Date().toISOString() }],
      tools: [],
      signal: ac.signal,
    })) {
      // First event proves the credentials + endpoint work.
      if (ev.type === "text" || ev.type === "done") break;
    }
    return NextResponse.json({ success: true, message: `Connected to ${provider.name}.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ success: false, error: message });
  } finally {
    ac.abort();
  }
}
