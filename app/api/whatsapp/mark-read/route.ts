import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import { sendReadReceipt, normalizePhone } from "@/lib/whatsapp";
import type { WhatsAppConfig } from "@/types";

// POST /api/whatsapp/mark-read
// Body: { phone: string }
// Marks all unread inbound messages for the given contact as read in DB,
// and sends read receipts to 360dialog for each real wamid message.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone } = await req.json() as { phone: string };
  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });

  await connectDB();

  const normalized = normalizePhone(phone);

  // Mark all unread inbound messages for this contact as read in DB
  const unread = await WhatsAppMessage.find({
    from: normalized,
    direction: "in",
    isRead: { $ne: true },
  }).lean();

  if (unread.length === 0) {
    return NextResponse.json({ data: { marked: 0 } });
  }

  // Update all at once
  await WhatsAppMessage.updateMany(
    { from: normalized, direction: "in", isRead: { $ne: true } },
    { $set: { isRead: true } }
  );

  // Fire read receipts to 360dialog (best-effort, non-blocking)
  const settings = await Settings.findOne({ user_id: userId });
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;

  if (waCfg?.enabled && waCfg?.apiKey) {
    for (const msg of unread) {
      // Only send receipts for real wamid message IDs (not local generated ones)
      if (msg.messageId?.startsWith("wamid.")) {
        sendReadReceipt(waCfg, msg.messageId).catch(() => {});
      }
    }
  }

  return NextResponse.json({ data: { marked: unread.length } });
}
