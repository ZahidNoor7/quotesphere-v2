import { describe, it, expect, vi } from "vitest";

// Mock the Cloudinary ping so the route test never hits the network.
vi.mock("@/lib/cloudinary", () => ({
  testCloudinaryConnection: vi.fn(async (cfg: { apiSecret: string }) =>
    cfg.apiSecret === "good" ? { ok: true } : { ok: false, error: "Invalid Signature" },
  ),
}));

import { POST } from "@/app/api/cloudinary/test/route";
import { req, setSession } from "./helpers";

const good = { cloudName: "demo", apiKey: "123", apiSecret: "good" };

describe("POST /api/cloudinary/test", () => {
  it("401 without a session", async () => {
    await setSession(null);
    const r = await POST(req("/api/cloudinary/test", "POST", good));
    expect(r.status).toBe(401);
  });

  it("400 when a field is missing", async () => {
    const r = await POST(req("/api/cloudinary/test", "POST", { cloudName: "demo" }));
    expect(r.status).toBe(400);
  });

  it("200 on valid credentials", async () => {
    const r = await POST(req("/api/cloudinary/test", "POST", good));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });

  it("400 on invalid credentials", async () => {
    const r = await POST(req("/api/cloudinary/test", "POST", { ...good, apiSecret: "bad" }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Invalid Signature/);
  });
});
