import { describe, it, expect, vi, afterEach } from "vitest";
import { sendWhatsAppMediaLink, mediaKindFromMime } from "@/lib/whatsapp";
import type { WhatsAppConfig } from "@/types";

const cfg: WhatsAppConfig = { enabled: true, mode: "production", apiKey: "test-key" };

function mockSend() {
  return vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ messages: [{ id: "wamid.ABC" }] }), { status: 200 })
  );
}

afterEach(() => vi.restoreAllMocks());

describe("mediaKindFromMime", () => {
  it("maps JPEG/PNG to image, others by family, rest to document", () => {
    expect(mediaKindFromMime("image/jpeg")).toBe("image");
    expect(mediaKindFromMime("image/png")).toBe("image");
    expect(mediaKindFromMime("image/webp")).toBe("document"); // webp not a valid WA image → document
    expect(mediaKindFromMime("video/mp4")).toBe("video");
    expect(mediaKindFromMime("audio/ogg")).toBe("audio");
    expect(mediaKindFromMime("application/pdf")).toBe("document");
    expect(mediaKindFromMime("")).toBe("document");
  });
});

describe("sendWhatsAppMediaLink", () => {
  it("sends an image by link with a caption", async () => {
    const spy = mockSend();
    const r = await sendWhatsAppMediaLink(cfg, "923001234567", { kind: "image", link: "https://cdn/x.jpg", caption: "Hello" });
    expect(r.messageId).toBe("wamid.ABC");
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ to: "923001234567", type: "image", image: { link: "https://cdn/x.jpg", caption: "Hello" } });
    // 360dialog key + production messages path
    expect(spy.mock.calls[0][0]).toBe("https://waba-v2.360dialog.io/messages");
    expect((spy.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "D360-API-KEY": "test-key" });
  });

  it("includes filename for documents", async () => {
    const spy = mockSend();
    await sendWhatsAppMediaLink(cfg, "1", { kind: "document", link: "https://cdn/f.pdf", caption: "Invoice", filename: "INV-1.pdf" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.document).toMatchObject({ link: "https://cdn/f.pdf", caption: "Invoice", filename: "INV-1.pdf" });
  });

  it("omits caption for audio (not supported by WhatsApp)", async () => {
    const spy = mockSend();
    await sendWhatsAppMediaLink(cfg, "1", { kind: "audio", link: "https://cdn/a.ogg", caption: "ignored" });
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.audio).toEqual({ link: "https://cdn/a.ogg" });
  });

  it("uses the sandbox base + path in sandbox mode", async () => {
    const spy = mockSend();
    await sendWhatsAppMediaLink({ ...cfg, mode: "sandbox" }, "1", { kind: "image", link: "https://cdn/x.jpg" });
    expect(spy.mock.calls[0][0]).toBe("https://waba-sandbox.360dialog.io/v1/messages");
  });
});
