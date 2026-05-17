import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import { normalizePhone } from "@/lib/whatsapp";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const conversations = await WhatsAppMessage.aggregate([
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
        lastMessageAt: 1,
        direction: 1,
        customer_id: 1,
        customer_name: 1,
        unreadCount: 1,
      },
    },
  ]);

  return NextResponse.json({ data: conversations });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
