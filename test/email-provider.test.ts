import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the nodemailer mock can reference them.
const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "smtp-123" });
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

import mongoose from "mongoose";
import { sendEmail, sendTestEmail } from "@/lib/email";
import { POST as testEmailPOST } from "@/app/api/email/test/route";
import Settings from "@/models/Settings";
import { req } from "./helpers";

const seedEmail = (email: Record<string, unknown>) =>
  Settings.create({ integrations: { email } });

describe("email provider routing (in-app config)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("routes to SMTP (nodemailer) when provider = smtp", async () => {
    await seedEmail({ enabled: true, provider: "smtp", smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true, smtpUser: "you@gmail.com", smtpPassword: "app-pass", fromName: "Me", fromEmail: "you@gmail.com" });
    const r = await sendEmail({ to: "x@test.com", subject: "Hi", html: "<p>hi</p>" });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "you@gmail.com", pass: "app-pass" } }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "Me <you@gmail.com>", to: ["x@test.com"], subject: "Hi" }));
    expect(r.id).toBe("smtp-123");
  });

  it("routes to Resend (HTTP) when provider = resend", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "resend-1" }), { status: 200 }));
    await seedEmail({ enabled: true, provider: "resend", apiKey: "re_test", fromName: "Biz", fromEmail: "no-reply@biz.com" });
    const r = await sendEmail({ to: "y@test.com", subject: "Hey", html: "<p>x</p>" });
    expect(fetchSpy).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    expect(createTransport).not.toHaveBeenCalled();
    expect(r.id).toBe("resend-1");
    fetchSpy.mockRestore();
  });

  it("silently skips (no error) when email isn't configured", async () => {
    const r = await sendEmail({ to: "z@test.com", subject: "x", html: "x" });
    expect(r).toEqual({});
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("ignores a disabled email integration", async () => {
    await seedEmail({ enabled: false, provider: "smtp", smtpHost: "smtp.gmail.com", smtpUser: "u", smtpPassword: "p" });
    const r = await sendEmail({ to: "z@test.com", subject: "x", html: "x" });
    expect(r).toEqual({});
    expect(createTransport).not.toHaveBeenCalled();
  });
});

describe("send a test email", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("sendTestEmail sends via the passed (unsaved) SMTP config", async () => {
    const r = await sendTestEmail({ provider: "smtp", smtpHost: "smtp.gmail.com", smtpPort: 587, smtpSecure: false, smtpUser: "u@g.com", smtpPassword: "pw", fromName: "T", fromEmail: "u@g.com" }, "dest@x.com");
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 587, secure: false }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: ["dest@x.com"], from: "T <u@g.com>" }));
    expect(r.id).toBe("smtp-123");
  });

  it("sendTestEmail errors when required fields are missing", async () => {
    const r = await sendTestEmail({ provider: "smtp", smtpHost: "smtp.gmail.com" }, "dest@x.com");
    expect(r.error).toBeTruthy();
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("POST /api/email/test sends with the posted config (200)", async () => {
    const res = await testEmailPOST(req("/api/email/test", "POST", { to: "x@test.com", config: { provider: "smtp", smtpHost: "smtp.gmail.com", smtpUser: "u", smtpPassword: "p", fromEmail: "u@g.com" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(sendMail).toHaveBeenCalled();
  });

  it("POST /api/email/test rejects an invalid recipient (400)", async () => {
    const res = await testEmailPOST(req("/api/email/test", "POST", { to: "not-an-email", config: { provider: "resend", apiKey: "x" } }));
    expect(res.status).toBe(400);
  });
});
