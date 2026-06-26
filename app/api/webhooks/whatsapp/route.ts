import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongoose";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import Customer from "@/models/Customer";
import { normalizePhone } from "@/lib/whatsapp";
import { runWithOrg } from "@/lib/tenant-context";
import mongoose from "mongoose";

/**
 * Verify the provider's HMAC-SHA256 signature. FAIL-CLOSED: if
 * WHATSAPP_WEBHOOK_SECRET is not configured we cannot authenticate the payload,
 * so we reject it (a public webhook that "allows when unconfigured" can be forged
 * to inject messages into a tenant's inbox). Operators MUST set the secret.
 */
function verifyWebhookSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook/whatsapp] WHATSAPP_WEBHOOK_SECRET not set — rejecting webhook (set the secret to enable inbound messages)");
    return false;
  }
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The business number that RECEIVED the message (Meta Cloud API metadata). */
function extractReceivingPhone(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const p = payload as Record<string, unknown>;
  const entries = Array.isArray(p.entry) ? (p.entry as Record<string, unknown>[]) : [];
  for (const entry of entries) {
    const changes = entry.changes as Record<string, unknown>[] | undefined;
    for (const change of changes ?? []) {
      const value = change.value as Record<string, unknown> | undefined;
      const metadata = value?.metadata as Record<string, unknown> | undefined;
      const phone = (metadata?.display_phone_number ?? metadata?.phone_number_id) as string | undefined;
      if (phone) return normalizePhone(String(phone));
    }
  }
  return "";
}

// Public endpoint — no auth. 360dialog POSTs inbound messages here.
export async function POST(req: NextRequest) {
  let raw = "";
  try { raw = await req.text(); } catch { return NextResponse.json({ received: true }, { status: 200 }); }

  if (!verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("[webhook/whatsapp] signature verification failed — ignoring payload");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Do NOT log the raw payload — it contains PII (phone numbers, message bodies).
  try {
    await processWebhook(raw);
  } catch (err) {
    console.error("[webhook/whatsapp] processing error:", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function processWebhook(raw: string) {
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return; }

  await connectDB();

  const db = mongoose.connection.db;
  if (!db) { console.warn("[webhook/whatsapp] DB not ready"); return; }

  // Route the inbound payload to the org that owns the receiving business number.
  // (Settings is read via the raw driver, so it is not tenant-scoped here.)
  const receivingPhone = extractReceivingPhone(payload);
  const enabled = await db
    .collection("settings")
    .find({
      "integrations.whatsapp.enabled": true,
      "integrations.whatsapp.apiKey": { $exists: true, $ne: "" },
    })
    .toArray();

  if (enabled.length === 0) {
    console.warn("[webhook/whatsapp] no WhatsApp settings found");
    return;
  }

  // Require an EXACT receiving-number match — never fall back to "the only enabled
  // org", which would mis-attribute a verified payload meant for a different
  // number to an unrelated tenant (cross-tenant message injection).
  const rawSettings =
    enabled.find((s) => normalizePhone(s?.integrations?.whatsapp?.phoneNumber ?? "") === receivingPhone) ?? null;
  if (!rawSettings) {
    console.warn("[webhook/whatsapp] could not route inbound to an org (no matching business number)");
    return;
  }

  const orgId = rawSettings.org_id ? String(rawSettings.org_id) : null;
  if (!orgId) {
    console.warn("[webhook/whatsapp] matched settings has no org_id");
    return;
  }
  const waPhone = normalizePhone(rawSettings?.integrations?.whatsapp?.phoneNumber ?? "");

  // Everything below runs inside the resolved org's tenant context, so the
  // tenant plugin scopes the message/customer queries and stamps org_id on writes.
  await runWithOrg(orgId, async () => {
    // Handle status updates (for outbound messages: sent → delivered → read)
    const statuses = extractStatuses(payload);
    for (const s of statuses) {
      if (!s.id || !s.status) continue;
      const update: Record<string, unknown> = { status: s.status };
      if (s.status === "failed" && s.errors?.length) {
        const e = s.errors[0];
        update.errorCode = String(e.code ?? "");
        update.errorDetails = e.title ?? e.message ?? e.error_data?.details ?? "Delivery failed";
        console.log(`[webhook/whatsapp] failed: code=${e.code} title=${e.title} msg=${e.message}`);
      }
      await WhatsAppMessage.updateOne({ messageId: s.id }, { $set: update });
      console.log(`[webhook/whatsapp] status update: ${s.id} → ${s.status}`);
    }

    // Handle inbound messages
    const messages = extractMessages(payload);
    console.log(`[webhook/whatsapp] extracted ${messages.length} message(s), org=${orgId}`);

    for (const msg of messages) {
      const from = normalizePhone(msg.from ?? "");
      const messageId = msg.id ?? `wh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();
      const parsed = parseInbound(msg);

      // Metadata only — no `from` (customer phone) or message body in logs.
      console.log(`[webhook/whatsapp] inbound type=${parsed.messageType}`);

      if (!from) { console.log("[webhook/whatsapp] skipping — missing from"); continue; }
      if (parsed.messageType === "text" && !parsed.body) { console.log("[webhook/whatsapp] skipping — empty text"); continue; }

      const exists = await WhatsAppMessage.findOne({ messageId }).select("_id").lean();
      if (exists) { console.log("[webhook/whatsapp] duplicate, skipping"); continue; }

      const tailDigits = from.slice(-9);
      const customer = await Customer.findOne({ phone_no: { $regex: tailDigits } }).lean();

      const created = await WhatsAppMessage.create({
        direction: "in",
        from,
        to: waPhone,
        body: parsed.body,
        type: "text",
        messageType: parsed.messageType,
        mediaId: parsed.mediaId,
        mediaMime: parsed.mediaMime,
        mediaFilename: parsed.mediaFilename,
        caption: parsed.caption,
        location: parsed.location,
        messageId,
        status: "sent",
        customer_id: customer ? customer._id : undefined,
        customer_name: customer ? (customer as { name: string }).name : undefined,
        timestamp,
      });

      console.log(`[webhook/whatsapp] saved _id=${created._id} type=${parsed.messageType}`);
    }
  });
}

type InboundType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contacts";

interface ParsedInbound {
  messageType: InboundType;
  body: string;
  caption?: string;
  mediaId?: string;
  mediaMime?: string;
  mediaFilename?: string;
  location?: { lat: number; lng: number; name?: string; address?: string };
}

/** Normalise an inbound WhatsApp message of any type into our storage shape. */
function parseInbound(msg: RawMessage): ParsedInbound {
  const type = (msg.type ?? "text") as string;

  if (type === "image" || type === "video" || type === "audio" || type === "document" || type === "sticker") {
    const media = (msg as Record<string, RawMediaObj | undefined>)[type];
    const caption = media?.caption;
    return {
      messageType: type,
      body: caption ?? "",
      caption,
      mediaId: media?.id,
      mediaMime: media?.mime_type,
      mediaFilename: media?.filename,
    };
  }

  if (type === "location") {
    const loc = msg.location;
    return {
      messageType: "location",
      body: loc?.name ?? "Location",
      location: { lat: Number(loc?.latitude), lng: Number(loc?.longitude), name: loc?.name, address: loc?.address },
    };
  }

  if (type === "contacts") {
    const c = msg.contacts?.[0];
    const name = c?.name?.formatted_name ?? "Contact";
    const phone = c?.phones?.[0]?.phone ?? "";
    return { messageType: "contacts", body: `${name}${phone ? ` · ${phone}` : ""}` };
  }

  // text and any unknown/unsupported types fall back to text
  return { messageType: "text", body: msg.text?.body ?? (type !== "text" ? `[${type} message]` : "") };
}

interface RawMediaObj {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
  sha256?: string;
}

interface RawMessage {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  image?: RawMediaObj;
  video?: RawMediaObj;
  audio?: RawMediaObj;
  document?: RawMediaObj;
  sticker?: RawMediaObj;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: Array<{ name?: { formatted_name?: string }; phones?: Array<{ phone?: string }> }>;
  timestamp?: string | number;
}

interface RawStatus {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  timestamp?: string | number;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
}

function extractStatuses(payload: unknown): RawStatus[] {
  if (typeof payload !== "object" || payload === null) return [];
  const p = payload as Record<string, unknown>;

  // Cloud API format
  if (Array.isArray(p.entry)) {
    const result: RawStatus[] = [];
    for (const entry of p.entry as Record<string, unknown>[]) {
      const changes = entry.changes as Record<string, unknown>[] | undefined;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        const statuses = value?.statuses as RawStatus[] | undefined;
        if (Array.isArray(statuses)) result.push(...statuses);
      }
    }
    return result;
  }

  // Sandbox format
  if (Array.isArray(p.statuses)) return p.statuses as RawStatus[];

  return [];
}

function extractMessages(payload: unknown): RawMessage[] {
  if (typeof payload !== "object" || payload === null) return [];
  const p = payload as Record<string, unknown>;

  if (Array.isArray(p.entry)) {
    const msgs: RawMessage[] = [];
    for (const entry of p.entry as Record<string, unknown>[]) {
      const changes = entry.changes as Record<string, unknown>[] | undefined;
      if (!Array.isArray(changes)) continue;
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        const messages = value?.messages as RawMessage[] | undefined;
        if (Array.isArray(messages)) msgs.push(...messages);
      }
    }
    return msgs;
  }

  if (Array.isArray(p.messages)) return p.messages as RawMessage[];
  return [];
}
