import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import Customer from "@/models/Customer";
import { normalizePhone } from "@/lib/whatsapp";
import { guardWhatsApp } from "@/lib/whatsapp-route-guard";

type ConversationRow = {
  phone: string;
  lastMessage: string;
  lastMessageAt: Date;
  direction: "in" | "out";
  customer_id?: unknown;
  customer_name?: string;
  unreadCount: number;
  lastType?: string;
  lastFilename?: string;
};

/** Human-friendly preview for the conversation list (caption/text wins; otherwise a media label). */
function previewLabel(type: string | undefined, body: string, filename?: string): string {
  if (body && body.trim()) return body;
  switch (type) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "audio": return "🎤 Voice message";
    case "document": return `📄 ${filename ?? "Document"}`;
    case "sticker": return "🌟 Sticker";
    case "location": return "📍 Location";
    case "contacts": return "👤 Contact";
    default: return body ?? "";
  }
}

export async function GET() {
  const g = await guardWhatsApp("GET");
  if (g instanceof NextResponse) return g;

  await connectDB();

  const conversations = await WhatsAppMessage.aggregate<ConversationRow>([
    {
      $addFields: {
        contactPhone: {
          $cond: [{ $eq: ["$direction", "in"] }, "$from", "$to"],
        },
      },
    },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$contactPhone",
        lastMessage: { $first: "$body" },
        lastType: { $first: "$messageType" },
        lastFilename: { $first: "$mediaFilename" },
        lastMessageAt: { $first: "$timestamp" },
        direction: { $first: "$direction" },
        customer_id: { $first: "$customer_id" },
        customer_name: { $first: "$customer_name" },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$direction", "in"] }, { $ne: ["$isRead", true] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { lastMessageAt: -1 } },
    {
      $project: {
        _id: 0,
        phone: "$_id",
        lastMessage: 1,
        lastType: 1,
        lastFilename: 1,
        lastMessageAt: 1,
        direction: 1,
        customer_id: 1,
        customer_name: 1,
        unreadCount: 1,
      },
    },
  ]);

  // Resolve each conversation phone to a live customer (overrides any stale
  // snapshot stored on the message). Match is on normalized digits, so stored
  // formats like "+92 300 1234567" and webhook formats like "923001234567" align.
  const customers = await Customer.find({}, { name: 1, phone_no: 1 }).lean();
  const customerByPhone = new Map<string, { id: string; name: string }>();
  for (const c of customers) {
    if (!c.phone_no) continue;
    const key = normalizePhone(c.phone_no);
    if (!key) continue;
    customerByPhone.set(key, { id: String(c._id), name: c.name });
  }

  const enriched = conversations.map(conv => {
    const match = customerByPhone.get(normalizePhone(conv.phone));
    return {
      ...conv,
      lastMessage: previewLabel(conv.lastType, conv.lastMessage, conv.lastFilename),
      customer_id: match?.id ?? conv.customer_id,
      customer_name: match?.name ?? conv.customer_name,
    };
  });

  return NextResponse.json({ data: enriched });
}

export async function DELETE(req: NextRequest) {
  const g = await guardWhatsApp(req.method, { write: true });
  if (g instanceof NextResponse) return g;

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone query param required" }, { status: 400 });

  await connectDB();
  const normalized = normalizePhone(phone);

  const result = await WhatsAppMessage.deleteMany({
    $or: [{ from: normalized }, { to: normalized }],
  });

  return NextResponse.json({ data: { deleted: result.deletedCount } });
}
