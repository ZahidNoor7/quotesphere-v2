import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import type { AiAssistantConfig } from "@/types";
import { resolveProvider } from "@/lib/assistant/providers";
import { enterOrg } from "@/lib/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REWRITE_SYSTEM = `You refine a user's custom instructions for an AI billing assistant (QuoteSphere). Rewrite the given text so it is clear, concise, well-structured and actionable as guidance for the assistant. Keep the user's intent and constraints; do not add unrelated content. Return ONLY the improved instructions — no preamble, no quotes, no headings.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const orgId = (session.user as { org_id?: string }).org_id;
  if (!orgId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  enterOrg(orgId);

  let text = "";
  try {
    text = z.object({ text: z.string().min(1).max(4000) }).parse(await req.json()).text;
  } catch {
    return NextResponse.json({ success: false, error: "Provide some text to rewrite." }, { status: 400 });
  }

  await connectDB();
  const settings = (await Settings.findOne({}).lean()) as
    | { integrations?: { aiAssistant?: AiAssistantConfig } }
    | null;
  const cfg = settings?.integrations?.aiAssistant;

  const ac = new AbortController();
  try {
    const provider = resolveProvider(cfg);
    let out = "";
    for await (const ev of provider.streamChat({
      system: REWRITE_SYSTEM,
      messages: [{ id: "rewrite", role: "user", content: text, createdAt: new Date().toISOString() }],
      tools: [],
      signal: ac.signal,
    })) {
      if (ev.type === "text") out += ev.delta;
      else if (ev.type === "done") break;
    }
    const result = out.trim();
    if (!result) return NextResponse.json({ success: false, error: "The model returned nothing — please try again." });
    return NextResponse.json({ success: true, data: { text: result } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Rewrite failed" });
  } finally {
    ac.abort();
  }
}
