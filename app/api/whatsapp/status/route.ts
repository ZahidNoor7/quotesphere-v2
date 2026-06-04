import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { sendReadReceipt, sendTypingIndicator } from "@/lib/whatsapp";
import { enterOrg } from "@/lib/tenant-context";
import type { WhatsAppConfig } from "@/types";

// POST /api/whatsapp/status
// Body: { action: "read" | "typing", messageId: string }
// Sends a read receipt or typing indicator to 360dialog for a given inbound message ID.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = (session.user as { org_id?: string }).org_id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  enterOrg(orgId);

  const { action, messageId } = await req.json() as { action: "read" | "typing"; messageId: string };
  if (!action || !messageId) {
    return NextResponse.json({ error: "action and messageId are required" }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({});
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;

  if (!waCfg?.enabled || !waCfg?.apiKey) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });
  }

  if (action === "typing") {
    await sendTypingIndicator(waCfg, messageId);
  } else {
    await sendReadReceipt(waCfg, messageId);
  }

  return NextResponse.json({ success: true });
}
