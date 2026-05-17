import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import Customer from "@/models/Customer";
import { normalizePhone } from "@/lib/whatsapp";
import mongoose from "mongoose";

// Public endpoint — no auth. 360dialog POSTs inbound messages here.
export async function POST(req: NextRequest) {
  let raw = "";
  try { raw = await req.text(); } catch { return NextResponse.json({ received: true }, { status: 200 }); }

  console.log("[webhook/whatsapp] received payload:", raw.slice(0, 1200));

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

  const rawSettings = await db.collection("settings").findOne({
    "integrations.whatsapp.enabled": true,
    "integrations.whatsapp.apiKey": { $exists: true, $ne: "" },
  });

  if (!rawSettings) {
    console.warn("[webhook/whatsapp] no WhatsApp settings found");
    return;
  }

  const userId = rawSettings.user_id ?? rawSettings._id;
  const waPhone = normalizePhone(rawSettings?.integrations?.whatsapp?.phoneNumber ?? "");

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
  console.log(`[webhook/whatsapp] extracted ${messages.length} message(s), userId=${userId}`);

  for (const msg of messages) {
    const from = normalizePhone(msg.from ?? "");
    const body = msg.text?.body ?? "";
    const messageId = msg.id ?? `wh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

    console.log(`[webhook/whatsapp] msg id=${messageId} from=${from} body="${body}"`);

    if (!from || !body) { console.log("[webhook/whatsapp] skipping — missing from or body"); continue; }

    const exists = await WhatsAppMessage.exists({ messageId });
    if (exists) { console.log("[webhook/whatsapp] duplicate, skipping"); continue; }

    const tailDigits = from.slice(-9);
    const customer = await Customer.findOne({ phone_no: { $regex: tailDigits } }).lean();

    const created = await WhatsAppMessage.create({
      user_id: userId ?? undefined,
      direction: "in",
      from,
      to: waPhone,
      body,
      type: "text",
      messageId,
      status: "sent",
      customer_id: customer ? customer._id : undefined,
      customer_name: customer ? (customer as { name: string }).name : undefined,
      timestamp,
    });

    console.log(`[webhook/whatsapp] saved _id=${created._id} from=${from}`);
  }
}

interface RawMessage {
  from?: string;
  id?: string;
  text?: { body?: string };
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
