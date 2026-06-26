/**
 * Vercel Cron route — runs daily to auto-generate recurring invoices.
 *
 * Schedule (vercel.json):
 *   { "path": "/api/cron/recurring-invoices", "schedule": "0 0 * * *" }
 *
 * Secured by CRON_SECRET env var (set in Vercel dashboard).
 * Vercel automatically sends Authorization: Bearer <CRON_SECRET> on each invocation.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Settings from "@/models/Settings";
import { getNextNumberWithPattern } from "@/models/Counter";
import { bypassTenant, runWithOrg } from "@/lib/tenant-context";
import { isAuthorizedCron } from "@/lib/cron-auth";

function addFrequency(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":    d.setDate(d.getDate() + 7);       break;
    case "monthly":   d.setMonth(d.getMonth() + 1);     break;
    case "quarterly": d.setMonth(d.getMonth() + 3);     break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export const GET = async (req: NextRequest) => {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const now = new Date();

  // The cron spans every org — read due invoices in bypass mode, then generate
  // each new invoice inside its own org's tenant context.
  const due = await bypassTenant(async () => await Invoice.find({
    "recurrence.enabled": true,
    "recurrence.next_date": { $lte: now },
    $or: [
      { "recurrence.end_date": { $exists: false } },
      { "recurrence.end_date": { $gt: now } },
    ],
  }).lean()) as any[];

  const generated: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const src of due) {
    try {
      if (!src.org_id) { errors.push({ id: String(src._id), error: "missing org_id" }); continue; }
      const orgId = String(src.org_id);
      await runWithOrg(orgId, async () => {
        // Clone the invoice — strip identity fields, reset payment state. `rest`
        // carries org_id from the source, so the clone stays in the same org.
        const {
          _id, invoice_no: _no, createdAt, updatedAt,
          payments, total_paid, outstanding, balance, payment_status,
          recurrence, ...rest
        } = src;
        void _id; void _no; void createdAt; void updatedAt;
        void payments; void total_paid; void outstanding; void balance; void payment_status;

        const nextDate = addFrequency(now, recurrence.frequency);

        // Atomic claim: advance the source's next_date ONLY if it still equals
        // the value we read. Two concurrent cron runs (overlap / manual re-trigger)
        // race on this update — exactly one wins and generates the invoice; the
        // loser gets null and skips, so a recurring invoice is never double-billed.
        const claimed = await Invoice.findOneAndUpdate(
          { _id: src._id, "recurrence.next_date": recurrence?.next_date },
          { $set: { "recurrence.next_date": nextDate } },
        );
        if (!claimed) return; // another run already generated this period

        // Org settings for the number pattern (scoped by the tenant plugin).
        const orgSettings = await Settings.findOne({}).lean() as any;
        const prefix  = orgSettings?.invoice_prefix ?? "INV";
        const pattern = orgSettings?.invoice_number_pattern ?? null;
        const invoice_no = await getNextNumberWithPattern(orgId, "invoice", prefix, pattern);

        const newInvoice = new Invoice({
          ...rest,
          invoice_no,
          issue_date: now,
          status: "issued",
          payment_status: "pending",
          payments: [],
          total_paid: 0,
          outstanding: rest.total_amount,
          balance: rest.total_amount,
          advance: 0,
          recurrence: {
            ...recurrence,
            next_date: nextDate,
          },
        });
        await newInvoice.save();

        generated.push(invoice_no);
      });
    } catch (err: any) {
      errors.push({ id: String(src._id), error: err.message });
    }
  }

  return NextResponse.json({ success: true, generated, errors, processed: due.length });
};
