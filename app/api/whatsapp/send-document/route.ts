import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import { sendWhatsAppMessage, uploadWhatsAppMedia, sendWhatsAppDocument, normalizePhone } from "@/lib/whatsapp";
import type { WhatsAppConfig } from "@/types";
import mongoose from "mongoose";

// POST /api/whatsapp/send-document
// Body: { phone, message, pdfBase64?, filename? }
// If pdfBase64 is provided (production mode only): uploads PDF to 360dialog, sends document + text.
// In sandbox mode: skips PDF (not supported), sends text only.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, message, pdfBase64, filename } = await req.json() as {
    phone: string;
    message: string;
    pdfBase64?: string;
    filename?: string;
  };

  if (!phone || !message) {
    return NextResponse.json({ error: "phone and message are required" }, { status: 400 });
  }

  await connectDB();
  const settings = await Settings.findOne({ user_id: userId });
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;

  if (!waCfg?.enabled || !waCfg?.apiKey) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  const results: { text?: string; document?: string; pdfSkipped?: string } = {};

  // 1. Send the text message
  try {
    const { messageId } = await sendWhatsAppMessage(waCfg, normalized, message);
    results.text = messageId;
    await WhatsAppMessage.create({
      user_id: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      direction: "out",
      from: waCfg.phoneNumber ?? "business",
      to: normalized,
      body: message,
      type: "text",
      messageId,
      status: "sent",
      timestamp: new Date(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Text send failed" }, { status: 500 });
  }

  // 2. If PDF provided, upload and send as document (production only)
  if (pdfBase64 && filename) {
    if (waCfg.mode === "sandbox") {
      results.pdfSkipped = "PDF attachment not supported in sandbox mode — switch to production.";
    } else {
      try {
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const mediaId = await uploadWhatsAppMedia(waCfg, pdfBuffer.buffer, filename);
        const { messageId } = await sendWhatsAppDocument(waCfg, normalized, mediaId, filename,
          `📎 ${filename}`);
        results.document = messageId;
        await WhatsAppMessage.create({
          user_id: userId ? new mongoose.Types.ObjectId(userId) : undefined,
          direction: "out",
          from: waCfg.phoneNumber ?? "business",
          to: normalized,
          body: `[PDF] ${filename}`,
          type: "text",
          messageId,
          status: "sent",
          timestamp: new Date(),
        });
      } catch (err) {
        results.pdfSkipped = err instanceof Error ? err.message : "PDF send failed";
      }
    }
  }

  return NextResponse.json({ success: true, data: results });
}
