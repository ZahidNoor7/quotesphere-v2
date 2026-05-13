import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Customer from "@/models/Customer";
import Expense from "@/models/Expense";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/dashboard", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();

    const effectiveFrom = fromParam
      ? new Date(fromParam)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const effectiveTo = toParam
      ? (() => { const d = new Date(toParam); d.setHours(23, 59, 59, 999); return d; })()
      : now;

    const invoiceMatch: Record<string, any> = { status: { $ne: "cancelled" } };
    if (fromParam || toParam) {
      invoiceMatch.issue_date = {};
      if (fromParam) invoiceMatch.issue_date.$gte = new Date(fromParam);
      if (toParam) {
        const d = new Date(toParam);
        d.setHours(23, 59, 59, 999);
        invoiceMatch.issue_date.$lte = d;
      }
    }

    const [
      [revenueStat],
      overdueCount,
      revenueByMonthRaw,
      topClientsRaw,
      paymentBreakdownRaw,
      recentInvoices,
      invoiceCount,
      quotationCount,
      customerCount,
      [expenseStat],
    ] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: null, totalRevenue: { $sum: "$total_amount" }, totalReceived: { $sum: "$total_paid" }, totalOutstanding: { $sum: "$outstanding" } } },
      ]),
      Invoice.countDocuments({ ...invoiceMatch, due_date: { $lt: now }, payment_status: { $ne: "complete" } }),
      Invoice.aggregate([
        { $match: { ...invoiceMatch, issue_date: { $gte: effectiveFrom, $lte: effectiveTo } } },
        { $group: { _id: { year: { $year: "$issue_date" }, month: { $month: "$issue_date" } }, revenue: { $sum: "$total_amount" }, received: { $sum: { $ifNull: ["$total_paid", 0] } } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: "$customer_id", name: { $first: "$customer_name" }, total: { $sum: "$total_amount" }, paid: { $sum: { $ifNull: ["$total_paid", 0] } } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: "$payment_status", count: { $sum: 1 }, amount: { $sum: "$total_amount" } } },
      ]),
      Invoice.find(invoiceMatch).sort({ issue_date: -1 }).limit(5).lean(),
      Invoice.countDocuments(invoiceMatch),
      Quotation.countDocuments(),
      Customer.countDocuments({ status: true }),
      Expense.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
    ]);

    const totalRevenue     = revenueStat?.totalRevenue    ?? 0;
    const totalReceived    = revenueStat?.totalReceived   ?? 0;
    const totalOutstanding = revenueStat?.totalOutstanding ?? 0;
    const totalExpenses    = expenseStat?.total           ?? 0;

    const spanYears = effectiveTo.getFullYear() !== effectiveFrom.getFullYear();
    const monthlyMap = new Map<string, { label: string; revenue: number; received: number }>();
    let cursor = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
    while (cursor <= effectiveTo) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
      const label = spanYears
        ? cursor.toLocaleString("default", { month: "short", year: "2-digit" })
        : cursor.toLocaleString("default", { month: "short" });
      monthlyMap.set(key, { label, revenue: 0, received: 0 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    for (const row of revenueByMonthRaw) {
      const key = `${row._id.year}-${row._id.month}`;
      const entry = monthlyMap.get(key);
      if (entry) { entry.revenue = row.revenue; entry.received = row.received; }
    }
    const revenueByMonth = Array.from(monthlyMap.values()).map(({ label, revenue, received }) => ({ month: label, revenue, received }));
    const topClients = topClientsRaw.map((r: any) => ({ name: r.name, total: r.total, paid: r.paid }));
    const paymentStatusBreakdown = ["pending", "partial", "complete"].map((status) => {
      const row = paymentBreakdownRaw.find((r: any) => r._id === status);
      return { status, count: row?.count ?? 0, amount: row?.amount ?? 0 };
    });

    return NextResponse.json({
      success: true,
      data: { totalRevenue, totalReceived, totalOutstanding, totalExpenses, invoiceCount, quotationCount, customerCount, overdueCount, revenueByMonth, topClients, recentInvoices, paymentStatusBreakdown },
    });
  } catch (err) {
    console.error("[dashboard]", err);
    return NextResponse.json({ success: false, error: "Failed to load dashboard" }, { status: 500 });
  }
});
