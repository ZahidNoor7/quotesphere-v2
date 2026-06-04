/**
 * Vercel Cron route — runs daily to send payment reminders (email + WhatsApp)
 * for unpaid invoices that are due soon or overdue.
 *
 * Schedule (vercel.json): { "path": "/api/cron/reminders", "schedule": "0 9 * * *" }
 * Secured by CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>).
 * Behaviour is owner-configurable in Settings.reminders.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import Settings from "@/models/Settings";
import { sendPaymentReminderEmail } from "@/lib/email";
import { sendWhatsAppMessage, normalizePhone } from "@/lib/whatsapp";
import { bypassTenant, runWithOrg } from "@/lib/tenant-context";
import type { WhatsAppConfig } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CRON_SECRET = process.env.CRON_SECRET;
const DAY = 24 * 60 * 60 * 1000;
const MAX_EMAILS_PER_RUN = 100; // Resend free-tier daily cap

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b && startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
const fmtDate = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const GET = async (req: NextRequest) => {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await connectDB();

  // Each organization has its own Settings doc with reminder prefs + channels.
  // Read them across all orgs (bypass), then process each org's invoices in its
  // own tenant context so every query stays org-scoped.
  const allSettings = (await bypassTenant(async () =>
    await Settings.find({ "reminders.enabled": true }).lean(),
  )) as any[];

  const today = startOfDay(new Date());
  const now = new Date();

  let sent = 0;
  let emailsSent = 0; // global cap across all orgs (Resend free-tier daily limit)
  let skipped = 0;
  let processed = 0;
  const errors: { invoice: string; error: string }[] = [];

  for (const settings of allSettings) {
    if (!settings.org_id) continue;
    const reminders = settings.reminders;
    if (!reminders?.enabled) continue;

    const companyName: string = settings?.company_name ?? "Your company";
    const dueSoonDays: number = reminders.dueSoonDays ?? 3;
    const overdueDays: number[] = Array.isArray(reminders.overdueDays) ? reminders.overdueDays : [1, 7, 14];
    const wantEmail = reminders.channels?.email !== false;
    const waCfg = settings?.integrations?.whatsapp as WhatsAppConfig | undefined;
    const waReady = !!reminders.channels?.whatsapp && !!waCfg?.enabled && !!waCfg?.apiKey;

    await runWithOrg(String(settings.org_id), async () => {
      const invoices = (await Invoice.find({
        status: "issued",
        payment_status: { $ne: "complete" },
        due_date: { $ne: null },
      }).lean()) as any[];
      processed += invoices.length;

      for (const inv of invoices) {
        if (!inv.due_date) { skipped++; continue; }

        const due = startOfDay(new Date(inv.due_date));
        const daysUntilDue = Math.round((due.getTime() - today.getTime()) / DAY);
        const daysOverdue = -daysUntilDue;

        const isDueSoon = daysUntilDue === dueSoonDays;
        const isOverdue = daysOverdue > 0 && overdueDays.includes(daysOverdue);
        if (!isDueSoon && !isOverdue) { skipped++; continue; }

        // At most one reminder per invoice per day (idempotent if the cron re-runs).
        if (sameDay(inv.lastReminderAt, now)) { skipped++; continue; }

        const outstanding = inv.outstanding ?? inv.total_amount ?? 0;
        if (outstanding <= 0) { skipped++; continue; }

        let didSend = false;

        // Email — the address lives on the Customer record.
        if (wantEmail && emailsSent < MAX_EMAILS_PER_RUN) {
          try {
            const customer = (await Customer.findById(inv.customer_id, "email name").lean()) as any;
            if (customer?.email) {
              const res = await sendPaymentReminderEmail({
                to: customer.email,
                customerName: inv.customer_name ?? customer.name ?? "there",
                invoiceNo: inv.invoice_no,
                dueDate: fmtDate(inv.due_date),
                outstandingAmount: outstanding,
                currency: inv.currency ?? "PKR",
                companyName,
                daysOverdue: Math.max(0, daysOverdue),
              });
              if (res?.error) errors.push({ invoice: inv.invoice_no, error: `email: ${res.error}` });
              else { emailsSent++; didSend = true; }
            }
          } catch (err: any) {
            errors.push({ invoice: inv.invoice_no, error: `email: ${err.message}` });
          }
        }

        // WhatsApp — uses the phone stored on the invoice.
        if (waReady && inv.customer_phone) {
          try {
            const amount = `${inv.currency ?? "PKR"} ${Number(outstanding).toLocaleString()}`;
            const text = daysOverdue > 0
              ? `Hi ${inv.customer_name}, a friendly reminder from ${companyName}: invoice ${inv.invoice_no} is overdue by ${daysOverdue} day(s). Outstanding: ${amount}. Thank you!`
              : `Hi ${inv.customer_name}, a friendly reminder from ${companyName}: invoice ${inv.invoice_no} is due on ${fmtDate(inv.due_date)}. Outstanding: ${amount}. Thank you!`;
            await sendWhatsAppMessage(waCfg!, normalizePhone(inv.customer_phone), text);
            didSend = true;
          } catch (err: any) {
            errors.push({ invoice: inv.invoice_no, error: `whatsapp: ${err.message}` });
          }
        }

        if (didSend) {
          await Invoice.findByIdAndUpdate(inv._id, { lastReminderAt: now });
          sent++;
        } else {
          skipped++;
        }
      }
    });
  }

  return NextResponse.json({ success: true, processed, sent, emailsSent, skipped, errors });
};
