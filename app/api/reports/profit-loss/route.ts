import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/reports/profit-loss", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam   = searchParams.get("to");
    const projectId = searchParams.get("project_id");

    const now = new Date();
    const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), 0, 1);
    const to   = toParam
      ? (() => { const d = new Date(toParam); d.setHours(23, 59, 59, 999); return d; })()
      : now;

    const invoiceMatch: Record<string, any> = {
      status: { $ne: "cancelled" },
      issue_date: { $gte: from, $lte: to },
    };
    const expenseMatch: Record<string, any> = {
      status: { $ne: "cancelled" },
      bill_date: { $gte: from, $lte: to },
    };
    if (projectId) {
      invoiceMatch.project_id = projectId;
      expenseMatch.project_id = projectId;
    }

    const [
      invoiceAgg,
      expenseAgg,
      revenueByMonthRaw,
      expensesByMonthRaw,
      expensesByCategoryRaw,
    ] = await Promise.all([
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: null, revenue: { $sum: "$total_amount" }, received: { $sum: "$total_paid" }, outstanding: { $sum: "$outstanding" }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, total: { $sum: "$total_amount" }, count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: { year: { $year: "$issue_date" }, month: { $month: "$issue_date" } }, revenue: { $sum: "$total_amount" }, received: { $sum: "$total_paid" } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: { year: { $year: "$bill_date" }, month: { $month: "$bill_date" } }, expenses: { $sum: "$total_amount" } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ["$items.category", "Uncategorized"] }, total: { $sum: "$items.total" } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const totalRevenue  = invoiceAgg[0]?.revenue     ?? 0;
    const totalReceived = invoiceAgg[0]?.received     ?? 0;
    const totalExpenses = expenseAgg[0]?.total        ?? 0;
    const grossProfit   = totalRevenue - totalExpenses;
    const grossMargin   = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Build month-keyed map spanning from → to
    const spanYears = to.getFullYear() !== from.getFullYear();
    const monthMap = new Map<string, { label: string; revenue: number; received: number; expenses: number }>();
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
      const label = spanYears
        ? cursor.toLocaleString("default", { month: "short", year: "2-digit" })
        : cursor.toLocaleString("default", { month: "short" });
      monthMap.set(key, { label, revenue: 0, received: 0, expenses: 0 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    for (const r of revenueByMonthRaw) {
      const key = `${r._id.year}-${r._id.month}`;
      const entry = monthMap.get(key);
      if (entry) { entry.revenue = r.revenue; entry.received = r.received; }
    }
    for (const r of expensesByMonthRaw) {
      const key = `${r._id.year}-${r._id.month}`;
      const entry = monthMap.get(key);
      if (entry) entry.expenses = r.expenses;
    }
    const monthly = Array.from(monthMap.values()).map(e => ({
      ...e,
      profit: e.revenue - e.expenses,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalReceived,
        totalExpenses,
        grossProfit,
        grossMargin: Math.round(grossMargin * 10) / 10,
        invoiceCount: invoiceAgg[0]?.count ?? 0,
        expenseCount: expenseAgg[0]?.count ?? 0,
        monthly,
        expensesByCategory: (expensesByCategoryRaw as any[]).map(r => ({ category: r._id, total: r.total })),
        isLoss: grossProfit < 0,
      },
    });
  } catch (err) {
    console.error("[reports/profit-loss GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch P&L report" }, { status: 500 });
  }
});
