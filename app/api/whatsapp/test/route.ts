import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { testWhatsAppConnection } from "@/lib/whatsapp";
import { enterOrg } from "@/lib/tenant-context";
import type { WhatsAppConfig } from "@/types";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = (session.user as { org_id?: string }).org_id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  enterOrg(orgId);

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
