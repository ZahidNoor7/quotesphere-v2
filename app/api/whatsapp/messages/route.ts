import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import Customer from "@/models/Customer";
import { sendWhatsAppMessage, sendWhatsAppMediaLink, mediaKindFromMime, normalizePhone, WA_MEDIA_LIMITS } from "@/lib/whatsapp";
import { resolveCloudinaryConfig, uploadToCloudinary, CLOUDINARY_NOT_CONFIGURED } from "@/lib/cloudinary";
import { cloudinaryFolder } from "@/lib/cloudinary-folders";
import { enterOrg } from "@/lib/tenant-context";
import type { WhatsAppConfig } from "@/types";

/** Rough byte size of a base64 data URI payload. */
function dataUriBytes(dataUri: string): number {
  const b64 = dataUri.includes(",") ? dataUri.slice(dataUri.indexOf(",") + 1) : dataUri;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = (session.user as { org_id?: string }).org_id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  enterOrg(orgId);

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone query param required" }, { status: 400 });
  }

  await connectDB();
  const normalized = normalizePhone(phone);

  // Scoped to the caller's org by the tenant plugin, then filtered to this contact.
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
  const orgId = (session.user as { org_id?: string }).org_id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  enterOrg(orgId);

  await connectDB();
  const settings = await Settings.findOne({});
  const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;

  if (!waCfg?.enabled || !waCfg?.apiKey) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });
  }

  const { to, body, attachment } = await req.json() as {
    to?: string;
    body?: string;
    attachment?: { dataUri: string; filename: string; mime: string };
  };

  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });
  if (!attachment && !body?.trim()) {
    return NextResponse.json({ error: "A message body or an attachment is required" }, { status: 400 });
  }

  const normalized = normalizePhone(to);
  const caption = body?.trim() || undefined;

  const customer = await Customer.findOne({
    user_id: userId,
    phone_no: { $regex: normalized.slice(-9) },
  }).lean();

  const baseDoc = {
    user_id: settings!._id, // settings ObjectId as a stable user reference
    direction: "out" as const,
    from: waCfg.phoneNumber ?? "business",
    to: normalized,
    status: "sent" as const,
    customer_id: customer ? customer._id : undefined,
    customer_name: customer ? (customer as { name: string }).name : undefined,
    timestamp: new Date(),
  };

  // ── Media attachment: host on Cloudinary, send to WhatsApp by link ──
  if (attachment?.dataUri) {
    const cloud = await resolveCloudinaryConfig(userId);
    if (!cloud) return NextResponse.json({ error: CLOUDINARY_NOT_CONFIGURED }, { status: 400 });

    const kind = mediaKindFromMime(attachment.mime);
    const limit = WA_MEDIA_LIMITS[kind];
    if (dataUriBytes(attachment.dataUri) > limit.maxBytes) {
      return NextResponse.json({ error: `${kind} files must be ${limit.label} or smaller for WhatsApp.` }, { status: 400 });
    }

    let secureUrl: string;
    try {
      // Documents (esp. PDFs) go as `raw` so Cloudinary delivers the file as-is —
      // PDFs uploaded as `image` are blocked by Cloudinary's default delivery setting.
      // For raw uploads from a data URI we must put the filename (with extension) in
      // the public_id, otherwise the delivery URL has no extension and the file
      // downloads as an unopenable, randomly-named blob.
      const isDoc = kind === "document";
      const safeName = attachment.filename.replace(/[^\w.\-]+/g, "_");
      // Group media per conversation: by customer when known, else by phone number.
      const waFolder = cloudinaryFolder("whatsapp", customer ? String(customer._id) : normalized);
      const uploaded = await uploadToCloudinary(cloud, attachment.dataUri, {
        resource_type: isDoc ? "raw" : "auto",
        // Raw docs keep the filename (with extension) in the public_id, so the folder
        // is embedded there; media uses the regular `folder` option.
        ...(isDoc ? { public_id: `${waFolder}/${Date.now()}-${safeName}` } : { folder: waFolder }),
      });
      secureUrl = uploaded.secure_url;
    } catch {
      return NextResponse.json({ error: "Failed to upload the attachment. Check your Cloudinary settings." }, { status: 502 });
    }

    const { messageId } = await sendWhatsAppMediaLink(waCfg, normalized, {
      kind,
      link: secureUrl,
      caption,
      filename: attachment.filename,
    });

    const msg = await WhatsAppMessage.create({
      ...baseDoc,
      body: caption ?? "",
      type: "text",
      messageType: kind,
      mediaUrl: secureUrl,
      mediaMime: attachment.mime,
      mediaFilename: attachment.filename,
      caption,
      messageId,
    });
    return NextResponse.json({ data: msg });
  }

  // ── Plain text ──
  const { messageId } = await sendWhatsAppMessage(waCfg, normalized, caption!);
  const msg = await WhatsAppMessage.create({
    ...baseDoc,
    body: caption!,
    type: "text",
    messageType: "text",
    messageId,
  });

  return NextResponse.json({ data: msg });
}
