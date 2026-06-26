import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { testWhatsAppConnection } from "@/lib/whatsapp";
import { guardWhatsApp } from "@/lib/whatsapp-route-guard";
import type { WhatsAppConfig } from "@/types";

export async function POST() {
  const g = await guardWhatsApp("POST", { write: true });
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

  // Returns { success, webhookUrl } — webhookUrl is what 360dialog currently has on file
  const result = await testWhatsAppConnection(waCfg);
  return NextResponse.json(result);
}
