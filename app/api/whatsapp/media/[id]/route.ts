import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import { fetchWhatsAppMedia } from "@/lib/whatsapp";
import { guardWhatsApp } from "@/lib/whatsapp-route-guard";
import type { WhatsAppConfig } from "@/types";

// GET /api/whatsapp/media/[id]
// Streams inbound WhatsApp media (private to 360dialog) to the browser, authed.
// `id` is the 360dialog media id stored on the inbound message.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardWhatsApp(req.method);
  if (g instanceof NextResponse) return g;

  const { id } = await params;
  await connectDB();

  // Tenant plugin scopes this to the caller's org — only their own media is found.
  const msg = await WhatsAppMessage.findOne({ mediaId: id }).lean<{ mediaMime?: string; mediaFilename?: string } | null>();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await Settings.findOne({});
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;
  if (!waCfg?.enabled || !waCfg?.apiKey) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });
  }

  try {
    const { buffer, contentType } = await fetchWhatsAppMedia(waCfg, id);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": msg.mediaMime || contentType || "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
        ...(msg.mediaFilename ? { "Content-Disposition": `inline; filename="${msg.mediaFilename.replace(/"/g, "")}"` } : {}),
      },
    });
  } catch (err) {
    console.error("[whatsapp/media] fetch failed:", err);
    return NextResponse.json({ error: "Media unavailable (WhatsApp media links expire after 7 days)" }, { status: 502 });
  }
}
