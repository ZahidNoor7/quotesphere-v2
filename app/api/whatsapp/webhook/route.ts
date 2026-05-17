import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { setWhatsAppWebhook } from "@/lib/whatsapp";
import type { WhatsAppConfig } from "@/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const settings = await Settings.findOne({ user_id: userId });
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;

  if (!waCfg?.enabled || !waCfg?.apiKey) {
    return NextResponse.json(
      { success: false, error: "WhatsApp integration not enabled or API key missing" },
      { status: 400 }
    );
  }

  const { webhookUrl } = await req.json();
  if (!webhookUrl) {
    return NextResponse.json({ success: false, error: "webhookUrl is required" }, { status: 400 });
  }

  const result = await setWhatsAppWebhook(waCfg, webhookUrl);
  return NextResponse.json(result);
}
