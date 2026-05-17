import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/reports/aging", async (_req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const now = new Date();

    // Fetch all incomplete invoices that have a due_date
    const invoices = await Invoice.find({
      status: { $ne: "cancelled" },
      payment_status: { $ne: "complete" },
      due_date: { $exists: true, $ne: null },
    })
      .select("invoice_no customer_name customer_id due_date outstanding total_amount currency payment_status")
      .sort({ due_date: 1 })
      .lean() as any[];

    // Bucket definitions (days past due)
    const buckets = [
      { label: "Current (not due)", min: -Infinity, max: 0 },
      { label: "1 – 30 days",       min: 1,        max: 30  },
      { label: "31 – 60 days",      min: 31,       max: 60  },
      { label: "61 – 90 days",      min: 61,       max: 90  },
      { label: "90+ days",          min: 91,       max: Infinity },
    ];

    type BucketEntry = {
      label: string;
      invoiceCount: number;
      totalOutstanding: number;
      invoices: {
        invoice_no: string;
        customer_name: string;
        due_date: string;
        outstanding: number;
        total_amount: number;
        currency: string;
        daysOverdue: number;
      }[];
    };

    const result: BucketEntry[] = buckets.map(b => ({ label: b.label, invoiceCount: 0, totalOutstanding: 0, invoices: [] }));

    for (const inv of invoices) {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const bucketIdx = buckets.findIndex(b => daysOverdue >= b.min && daysOverdue <= b.max);
      if (bucketIdx === -1) continue;

      const bucket = result[bucketIdx];
      bucket.invoiceCount++;
      bucket.totalOutstanding += inv.outstanding ?? 0;
      bucket.invoices.push({
        invoice_no: inv.invoice_no,
        customer_name: inv.customer_name,
        due_date: inv.due_date,
        outstanding: inv.outstanding ?? 0,
        total_amount: inv.total_amount,
        currency: inv.currency ?? "PKR",
        daysOverdue,
      });
    }

    const summary = {
      totalOutstanding: result.reduce((s, b) => s + b.totalOutstanding, 0),
      totalInvoices: result.reduce((s, b) => s + b.invoiceCount, 0),
    };

    return NextResponse.json({ success: true, data: { buckets: result, summary } });
  } catch (err) {
    console.error("[reports/aging GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch aging report" }, { status: 500 });
  }
});
