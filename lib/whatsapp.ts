import type { WhatsAppConfig } from "@/types";

function getBaseUrl(mode: "sandbox" | "production") {
  return mode === "sandbox"
    ? "https://waba-sandbox.360dialog.io"
    : "https://waba-v2.360dialog.io";
}

function getMessagesPath(mode: "sandbox" | "production") {
  return mode === "sandbox" ? "/v1/messages" : "/messages";
}

function getWebhookPath(mode: "sandbox" | "production") {
  return mode === "sandbox" ? "/v1/configs/webhook" : "/v1/configs/webhook";
}

export async function sendWhatsAppMessage(
  cfg: WhatsAppConfig,
  to: string,
  body: string
): Promise<{ messageId: string }> {
  if (!cfg.apiKey) throw new Error("WhatsApp API key not configured");

  const base = getBaseUrl(cfg.mode);
  const path = getMessagesPath(cfg.mode);

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": cfg.apiKey,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.detail ?? ""; } catch { detail = await res.text().catch(() => ""); }
    if (res.status === 429) throw new Error(`Sandbox message limit reached (200 messages). Upgrade to a production API key to continue.`);
    throw new Error(`360dialog error ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const data = await res.json();
  const messageId = data?.messages?.[0]?.id ?? `local-${Date.now()}`;
  return { messageId };
}

export type WhatsAppMediaKind = "image" | "video" | "audio" | "document" | "sticker";

// 360dialog / WhatsApp Cloud API media constraints (per docs).
export const WA_MEDIA_LIMITS: Record<WhatsAppMediaKind, { maxBytes: number; label: string }> = {
  image: { maxBytes: 5 * 1024 * 1024, label: "5MB" },
  video: { maxBytes: 16 * 1024 * 1024, label: "16MB" },
  audio: { maxBytes: 16 * 1024 * 1024, label: "16MB" },
  document: { maxBytes: 100 * 1024 * 1024, label: "100MB" },
  sticker: { maxBytes: 500 * 1024, label: "500KB" },
};

/**
 * Map a MIME type to the WhatsApp media kind we'll send it as. Only JPEG/PNG go
 * as `image` (WhatsApp rejects other image types); everything not video/audio is
 * sent as a `document` for reliable delivery (webp/gif included).
 */
export function mediaKindFromMime(mime: string): WhatsAppMediaKind {
  const m = (mime || "").toLowerCase();
  if (m === "image/jpeg" || m === "image/png") return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}

// Send a media message by public link (works in sandbox AND production — no /media upload needed).
export async function sendWhatsAppMediaLink(
  cfg: WhatsAppConfig,
  to: string,
  opts: { kind: WhatsAppMediaKind; link: string; caption?: string; filename?: string }
): Promise<{ messageId: string }> {
  if (!cfg.apiKey) throw new Error("WhatsApp API key not configured");

  const base = getBaseUrl(cfg.mode);
  const path = getMessagesPath(cfg.mode);

  const mediaObj: Record<string, unknown> = { link: opts.link };
  // Captions are only valid on image / video / document.
  if (opts.caption && (opts.kind === "image" || opts.kind === "video" || opts.kind === "document")) {
    mediaObj.caption = opts.caption;
  }
  if (opts.kind === "document" && opts.filename) mediaObj.filename = opts.filename;

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "D360-API-KEY": cfg.apiKey },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: opts.kind,
      [opts.kind]: mediaObj,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.detail ?? ""; } catch { detail = await res.text().catch(() => ""); }
    if (res.status === 429) throw new Error("Sandbox message limit reached (200 messages). Upgrade to a production API key to continue.");
    throw new Error(`360dialog media send failed ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const data = await res.json();
  return { messageId: data?.messages?.[0]?.id ?? `media-${Date.now()}` };
}

/**
 * Fetch inbound media bytes from 360dialog by media id. 360 may return the binary
 * directly, or JSON containing a `url` that must then be fetched with the API key.
 */
export async function fetchWhatsAppMedia(
  cfg: WhatsAppConfig,
  mediaId: string
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  if (!cfg.apiKey) throw new Error("WhatsApp API key not configured");
  const base = getBaseUrl(cfg.mode);

  const res = await fetch(`${base}/${mediaId}`, {
    method: "GET",
    headers: { "D360-API-KEY": cfg.apiKey },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Media fetch failed ${res.status}`);

  const ct = res.headers.get("content-type") ?? "";
  // Cloud-API style: JSON pointing at the real download URL.
  if (ct.includes("application/json")) {
    const meta = await res.json();
    const url: string | undefined = meta?.url;
    if (!url) throw new Error("Media metadata had no url");
    const bin = await fetch(url, {
      method: "GET",
      headers: { "D360-API-KEY": cfg.apiKey },
      signal: AbortSignal.timeout(20000),
    });
    if (!bin.ok) throw new Error(`Media download failed ${bin.status}`);
    return { buffer: await bin.arrayBuffer(), contentType: meta?.mime_type ?? bin.headers.get("content-type") ?? "application/octet-stream" };
  }

  // 360dialog style: the binary is returned directly.
  return { buffer: await res.arrayBuffer(), contentType: ct || "application/octet-stream" };
}

export async function testWhatsAppConnection(
  cfg: WhatsAppConfig
): Promise<{ success: boolean; webhookUrl?: string; error?: string }> {
  if (!cfg.apiKey) return { success: false, error: "API key is required" };

  const base = getBaseUrl(cfg.mode);

  try {
    // GET the current webhook config — read-only, does NOT change the registered webhook URL
    const res = await fetch(`${base}/v1/configs/webhook`, {
      method: "GET",
      headers: {
        "D360-API-KEY": cfg.apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 200 || res.status === 201) {
      let webhookUrl: string | undefined;
      try {
        const json = await res.json();
        webhookUrl = json?.url ?? json?.webhook?.url;
      } catch { /* ignore parse error */ }
      return { success: true, webhookUrl };
    }

    const body = await res.text();
    return { success: false, error: `API returned ${res.status}: ${body.slice(0, 150)}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg };
  }
}

export async function setWhatsAppWebhook(
  cfg: WhatsAppConfig,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!cfg.apiKey) return { success: false, error: "API key is required" };

  const base = getBaseUrl(cfg.mode);
  const path = getWebhookPath(cfg.mode);

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": cfg.apiKey,
      },
      body: JSON.stringify({ url: webhookUrl }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 200 || res.status === 201) {
      return { success: true };
    }

    const body = await res.text();
    return { success: false, error: `API returned ${res.status}: ${body.slice(0, 120)}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg };
  }
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s+\-()]/g, "");
}

// Upload a PDF to 360dialog's media endpoint and return the media ID.
// Only works in production mode — sandbox does not support media upload.
export async function uploadWhatsAppMedia(
  cfg: WhatsAppConfig,
  pdfBuffer: ArrayBuffer,
  filename: string
): Promise<string> {
  if (cfg.mode === "sandbox") throw new Error("Media upload is not supported in sandbox mode. Switch to production.");
  if (!cfg.apiKey) throw new Error("API key is required");

  const base = getBaseUrl(cfg.mode);

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), filename);

  const res = await fetch(`${base}/media`, {
    method: "POST",
    headers: { "D360-API-KEY": cfg.apiKey },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Media upload failed ${res.status}: ${err.slice(0, 120)}`);
  }

  const data = await res.json();
  if (!data.id) throw new Error("360dialog did not return a media ID");
  return data.id as string;
}

// Send a PDF document as a WhatsApp message using an uploaded media ID.
export async function sendWhatsAppDocument(
  cfg: WhatsAppConfig,
  to: string,
  mediaId: string,
  filename: string,
  caption?: string
): Promise<{ messageId: string }> {
  if (!cfg.apiKey) throw new Error("API key is required");

  const base = getBaseUrl(cfg.mode);
  const path = getMessagesPath(cfg.mode);

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "D360-API-KEY": cfg.apiKey },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: { id: mediaId, filename, caption },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.detail ?? ""; } catch { detail = await res.text().catch(() => ""); }
    throw new Error(`Document send failed ${res.status}: ${detail.slice(0, 120)}`);
  }

  const data = await res.json();
  return { messageId: data?.messages?.[0]?.id ?? `doc-${Date.now()}` };
}

// Mark an inbound message as read. Shows double blue tick on customer's WhatsApp.
export async function sendReadReceipt(cfg: WhatsAppConfig, messageId: string): Promise<void> {
  if (!cfg.apiKey) return;
  const base = getBaseUrl(cfg.mode);
  const path = getMessagesPath(cfg.mode);
  await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "D360-API-KEY": cfg.apiKey },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => { /* fire and forget — non-critical */ });
}

// Show typing bubble on customer's WhatsApp (also marks message as read).
// Bubble lasts up to 25s or until the next outbound message is sent.
export async function sendTypingIndicator(cfg: WhatsAppConfig, messageId: string): Promise<void> {
  if (!cfg.apiKey) return;
  const base = getBaseUrl(cfg.mode);
  const path = getMessagesPath(cfg.mode);
  await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "D360-API-KEY": cfg.apiKey },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => { /* fire and forget */ });
}
