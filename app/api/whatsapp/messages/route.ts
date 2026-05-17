import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import Customer from "@/models/Customer";
import { sendWhatsAppMessage, normalizePhone } from "@/lib/whatsapp";
import type { WhatsAppConfig } from "@/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone query param required" }, { status: 400 });
  }

  await connectDB();
  const normalized = normalizePhone(phone);

  // Auth check is the access guard. No userId filter — handles messages saved
  // before the userId fix (which used a random ObjectId).
  const messages = await WhatsAppMessage.find({
    $or: [{ from: normalized }, { to: normalized }],
  })
    .sort({ timestamp: 1 })
    .limit(200)
    .lean();

  return NextResponse.json({ data: messages });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const settings = await Settings.findOne({ user_id: userId });
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;

  if (!waCfg?.enabled || !waCfg?.apiKey) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });
  }

  const { to, body } = await req.json();
  if (!to || !body) {
    return NextResponse.json({ error: "to and body are required" }, { status: 400 });
  }

  const normalized = normalizePhone(to);

  const customer = await Customer.findOne({
    user_id: userId,
    phone_no: { $regex: normalized.slice(-9) },
  }).lean();

  const { messageId } = await sendWhatsAppMessage(waCfg, normalized, body);

  const msg = await WhatsAppMessage.create({
    user_id: settings!._id,  // use settings ObjectId as stable user reference
    direction: "out",
    from: waCfg.phoneNumber ?? "business",
    to: normalized,
    body,
    type: "text",
    messageId,
    status: "sent",
    customer_id: customer ? customer._id : undefined,
    customer_name: customer ? (customer as { name: string }).name : undefined,
    timestamp: new Date(),
  });

  return NextResponse.json({ data: msg });
}
