import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { setWhatsAppWebhook } from "@/lib/whatsapp";
import { guardWhatsApp } from "@/lib/whatsapp-route-guard";
import type { WhatsAppConfig } from "@/types";

export async function POST(req: NextRequest) {
  const g = await guardWhatsApp(req.method, { write: true });
  if (g instanceof NextResponse) return g;

  await connectDB();
  const settings = await Settings.findOne({});
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
