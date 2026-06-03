/**
 * Email delivery — provider is configured in-app (Settings → Integrations → Email).
 * Exactly one provider is active at a time: Resend (HTTP API) or SMTP (e.g. Gmail,
 * via nodemailer). Falls back to RESEND_API_KEY env only when email isn't set up
 * in-app. If neither is configured, sends are silently skipped (safe for local dev).
 */
import nodemailer from "nodemailer";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import type { EmailConfig } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENV_FROM = process.env.RESEND_FROM ?? "QuoteSphere <no-reply@quotesphere.app>";

type ResolvedEmail =
  | { provider: "resend"; from: string; apiKey: string }
  | { provider: "smtp"; from: string; smtp: { host: string; port: number; secure: boolean; user: string; pass: string } }
  | null;

/** Map an email integration config → a resolved provider (ignores `enabled`; used by the test sender). */
function toResolved(e: Partial<EmailConfig> | null | undefined): ResolvedEmail {
  if (!e) return null;
  const from = e.fromEmail ? (e.fromName ? `${e.fromName} <${e.fromEmail}>` : e.fromEmail) : ENV_FROM;
  if (e.provider === "smtp" && e.smtpHost && e.smtpUser && e.smtpPassword) {
    return { provider: "smtp", from, smtp: { host: e.smtpHost, port: e.smtpPort ?? 465, secure: e.smtpSecure ?? true, user: e.smtpUser, pass: e.smtpPassword } };
  }
  if ((e.provider ?? "resend") === "resend" && e.apiKey) {
    return { provider: "resend", from, apiKey: e.apiKey };
  }
  return null;
}

/** Resolve the active provider + credentials from in-app Settings (env Resend fallback). */
async function resolveEmailConfig(): Promise<ResolvedEmail> {
  try {
    await connectDB();
    const e = ((await Settings.findOne().lean()) as any)?.integrations?.email;
    if (e?.enabled) {
      const r = toResolved(e);
      if (r) return r;
    }
  } catch {
    /* fall through to env */
  }
  if (process.env.RESEND_API_KEY) return { provider: "resend", from: ENV_FROM, apiKey: process.env.RESEND_API_KEY };
  return null;
}

interface SendOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/** Send via an already-resolved provider. */
async function dispatch(cfg: ResolvedEmail, opts: SendOptions): Promise<{ id?: string; error?: string }> {
  if (!cfg) {
    console.warn("[email] No email provider configured (Settings → Integrations) — skipped:", opts.subject);
    return {};
  }
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  // ── SMTP (e.g. Gmail) ──
  if (cfg.provider === "smtp") {
    try {
      const transport = nodemailer.createTransport({
        host: cfg.smtp.host,
        port: cfg.smtp.port,
        secure: cfg.smtp.secure,
        auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
      });
      const info = await transport.sendMail({
        from: cfg.from, to, subject: opts.subject, html: opts.html,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      });
      return { id: info.messageId };
    } catch (err: any) {
      console.error("[email] SMTP error:", err?.message ?? err);
      return { error: err?.message ?? "Email send failed" };
    }
  }

  // ── Resend ──
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: cfg.from, to, subject: opts.subject, html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[email] Resend error:", data);
      return { error: data.message ?? "Email send failed" };
    }
    return { id: data.id };
  } catch (err) {
    console.error("[email] Network error:", err);
    return { error: "Email send failed" };
  }
}

export async function sendEmail(opts: SendOptions): Promise<{ id?: string; error?: string }> {
  return dispatch(await resolveEmailConfig(), opts);
}

/** Send a one-off test email using an explicit (possibly unsaved) integration config. */
export async function sendTestEmail(config: Partial<EmailConfig>, to: string): Promise<{ id?: string; error?: string }> {
  const cfg = toResolved(config);
  if (!cfg) return { error: "Fill in the selected provider's required fields first." };
  return dispatch(cfg, {
    to,
    subject: "QuoteSphere test email ✓",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#111"><h2 style="margin:0 0 12px">It works! ✅</h2><p style="margin:0 0 8px;color:#555">Your QuoteSphere email is configured correctly via <strong>${cfg.provider === "smtp" ? "SMTP" : "Resend"}</strong>.</p><p style="margin:0;color:#555">Invoices, quotations and payment reminders will send from this address.</p></div>`,
  });
}

// ─── Pre-built email templates ────────────────────────────────────────────────

export async function sendInvoiceEmail({
  to, customerName, invoiceNo, issueDate, dueDate, totalAmount, currency, companyName, invoiceUrl,
}: {
  to: string; customerName: string; invoiceNo: string; issueDate: string;
  dueDate?: string; totalAmount: number; currency: string; companyName: string; invoiceUrl?: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(totalAmount);
  const sym: Record<string, string> = { PKR: "Rs.", USD: "$", EUR: "€", GBP: "£", AED: "AED", SAR: "SAR" };
  const amount = `${sym[currency] ?? currency} ${formatted}`;

  return sendEmail({
    to,
    subject: `Invoice ${invoiceNo} from ${companyName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
        <h2 style="margin:0 0 16px;font-size:20px">Invoice ${invoiceNo}</h2>
        <p style="margin:0 0 8px">Hi ${customerName},</p>
        <p style="margin:0 0 24px;color:#555">
          Please find your invoice from <strong>${companyName}</strong> below.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#777;width:140px">Invoice No.</td><td style="padding:8px 0;font-weight:600">${invoiceNo}</td></tr>
          <tr><td style="padding:8px 0;color:#777">Issue Date</td><td style="padding:8px 0">${issueDate}</td></tr>
          ${dueDate ? `<tr><td style="padding:8px 0;color:#777">Due Date</td><td style="padding:8px 0;color:#dc2626;font-weight:600">${dueDate}</td></tr>` : ""}
          <tr><td style="padding:8px 0;color:#777">Amount Due</td><td style="padding:8px 0;font-weight:700;font-size:18px">${amount}</td></tr>
        </table>
        ${invoiceUrl ? `<a href="${invoiceUrl}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View Invoice</a>` : ""}
        <p style="margin:32px 0 0;font-size:13px;color:#999">This email was sent by ${companyName} via QuoteSphere.</p>
      </div>`,
  });
}

export async function sendPaymentReminderEmail({
  to, customerName, invoiceNo, dueDate, outstandingAmount, currency, companyName, daysOverdue,
}: {
  to: string; customerName: string; invoiceNo: string; dueDate: string;
  outstandingAmount: number; currency: string; companyName: string; daysOverdue: number;
}) {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(outstandingAmount);
  const sym: Record<string, string> = { PKR: "Rs.", USD: "$", EUR: "€", GBP: "£", AED: "AED", SAR: "SAR" };
  const amount = `${sym[currency] ?? currency} ${formatted}`;
  const urgency = daysOverdue > 30 ? "URGENT: " : daysOverdue > 0 ? "Overdue: " : "";

  return sendEmail({
    to,
    subject: `${urgency}Payment reminder — Invoice ${invoiceNo}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
        <h2 style="margin:0 0 16px;font-size:20px;color:${daysOverdue > 0 ? "#dc2626" : "#111"}">
          ${daysOverdue > 0 ? `Payment Overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}` : "Payment Reminder"}
        </h2>
        <p style="margin:0 0 8px">Hi ${customerName},</p>
        <p style="margin:0 0 24px;color:#555">
          This is a reminder that invoice <strong>${invoiceNo}</strong> from <strong>${companyName}</strong> is ${daysOverdue > 0 ? "overdue" : "due soon"}.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#777;width:140px">Invoice No.</td><td style="padding:8px 0;font-weight:600">${invoiceNo}</td></tr>
          <tr><td style="padding:8px 0;color:#777">Due Date</td><td style="padding:8px 0;color:#dc2626;font-weight:600">${dueDate}</td></tr>
          <tr><td style="padding:8px 0;color:#777">Outstanding</td><td style="padding:8px 0;font-weight:700;font-size:18px;color:#dc2626">${amount}</td></tr>
        </table>
        <p style="margin:32px 0 0;font-size:13px;color:#999">This email was sent by ${companyName} via QuoteSphere.</p>
      </div>`,
  });
}

export async function sendQuotationEmail({
  to, customerName, quotationNo, issueDate, validUntil, totalAmount, currency, companyName,
}: {
  to: string; customerName: string; quotationNo: string; issueDate: string;
  validUntil?: string; totalAmount: number; currency: string; companyName: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(totalAmount);
  const sym: Record<string, string> = { PKR: "Rs.", USD: "$", EUR: "€", GBP: "£", AED: "AED", SAR: "SAR" };
  const amount = `${sym[currency] ?? currency} ${formatted}`;

  return sendEmail({
    to,
    subject: `Quotation ${quotationNo} from ${companyName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
        <h2 style="margin:0 0 16px;font-size:20px">Quotation ${quotationNo}</h2>
        <p style="margin:0 0 8px">Hi ${customerName},</p>
        <p style="margin:0 0 24px;color:#555">
          Please find your quotation from <strong>${companyName}</strong> below.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#777;width:140px">Quotation No.</td><td style="padding:8px 0;font-weight:600">${quotationNo}</td></tr>
          <tr><td style="padding:8px 0;color:#777">Issue Date</td><td style="padding:8px 0">${issueDate}</td></tr>
          ${validUntil ? `<tr><td style="padding:8px 0;color:#777">Valid Until</td><td style="padding:8px 0;font-weight:600">${validUntil}</td></tr>` : ""}
          <tr><td style="padding:8px 0;color:#777">Total Amount</td><td style="padding:8px 0;font-weight:700;font-size:18px">${amount}</td></tr>
        </table>
        <p style="margin:0 0 0;color:#555;font-size:14px">
          To accept or decline this quotation, please contact us directly.
        </p>
        <p style="margin:32px 0 0;font-size:13px;color:#999">This email was sent by ${companyName} via QuoteSphere.</p>
      </div>`,
  });
}

export async function sendWelcomeEmail({
  to, name, loginUrl,
}: {
  to: string; name: string; loginUrl?: string;
}) {
  return sendEmail({
    to,
    subject: "Welcome to QuoteSphere",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
        <h2 style="margin:0 0 16px;font-size:20px">Welcome, ${name}!</h2>
        <p style="margin:0 0 24px;color:#555">
          Your QuoteSphere account has been created. You can start creating invoices, quotations, and managing your clients right away.
        </p>
        ${loginUrl ? `<a href="${loginUrl}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Sign In</a>` : ""}
        <p style="margin:32px 0 0;font-size:13px;color:#999">QuoteSphere — Business management made simple.</p>
      </div>`,
  });
}
