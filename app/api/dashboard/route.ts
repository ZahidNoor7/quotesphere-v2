import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Customer from "@/models/Customer";
import Expense from "@/models/Expense";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from"); // YYYY-MM-DD
    const toParam = searchParams.get("to");     // YYYY-MM-DD

    const now = new Date();

    // Determine effective date range for chart generation
    const effectiveFrom = fromParam
      ? new Date(fromParam)
      : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const effectiveTo = toParam
      ? (() => { const d = new Date(toParam); d.setHours(23, 59, 59, 999); return d; })()
      : now;

    // Build invoice query with optional date filter
    const invoiceQuery: Record<string, any> = { status: { $ne: "cancelled" } };
    if (fromParam || toParam) {
      invoiceQuery.issue_date = {};
      if (fromParam) invoiceQuery.issue_date.$gte = new Date(fromParam);
      if (toParam) {
        const toDate = new Date(toParam);
        toDate.setHours(23, 59, 59, 999);
        invoiceQuery.issue_date.$lte = toDate;
      }
    }

    const [invoices, quotations, customers, expenses] = await Promise.all([
      Invoice.find(invoiceQuery).sort({ issue_date: -1 }).limit(500).lean(),
      Quotation.find().countDocuments(),
      Customer.find({ status: true }).countDocuments(),
      Expense.find({ status: { $ne: "cancelled" } }).lean(),
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0);
    const totalReceived = invoices.reduce((s, i) => s + (i.total_paid || 0), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + (i.outstanding || 0), 0);
    const totalExpenses = (expenses as any[]).reduce((s, e) => s + e.total_amount, 0);

    const overdueCount = (invoices as any[]).filter((i) => {
      return i.due_date && new Date(i.due_date) < now && i.payment_status !== "complete";
    }).length;

    // Revenue by month — dynamically generated for the effective range
    const spanYears = effectiveTo.getFullYear() !== effectiveFrom.getFullYear();
    const monthlyMap = new Map<string, { label: string; revenue: number; received: number }>();
    let d = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
    while (d <= effectiveTo) {
      const mapKey = `${d.getFullYear()}-${d.getMonth()}`;
      const label = spanYears
        ? d.toLocaleString("default", { month: "short", year: "2-digit" })
        : d.toLocaleString("default", { month: "short" });
      monthlyMap.set(mapKey, { label, revenue: 0, received: 0 });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    (invoices as any[]).forEach((inv) => {
      const invDate = new Date(inv.issue_date);
      const mapKey = `${invDate.getFullYear()}-${invDate.getMonth()}`;
      const entry = monthlyMap.get(mapKey);
      if (entry) {
        entry.revenue += inv.total_amount;
        entry.received += inv.total_paid || 0;
      }
    });
    const revenueByMonth = Array.from(monthlyMap.values()).map(({ label, revenue, received }) => ({
      month: label,
      revenue,
      received,
    }));

    // Top clients
    const clientMap: Record<string, { name: string; total: number; paid: number }> = {};
    (invoices as any[]).forEach((inv) => {
      const id = inv.customer_id?.toString();
      if (!clientMap[id]) clientMap[id] = { name: inv.customer_name, total: 0, paid: 0 };
      clientMap[id].total += inv.total_amount;
      clientMap[id].paid += inv.total_paid || 0;
    });
    const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 5);

    // Payment breakdown
    const breakdown = { pending: 0, partial: 0, complete: 0 };
    (invoices as any[]).forEach((i) => {
      breakdown[i.payment_status as keyof typeof breakdown] =
        (breakdown[i.payment_status as keyof typeof breakdown] || 0) + 1;
    });
    const paymentStatusBreakdown = Object.entries(breakdown).map(([status, count]) => ({
      status,
      count,
      amount: (invoices as any[])
        .filter((i) => i.payment_status === status)
        .reduce((s, i) => s + i.total_amount, 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalReceived,
        totalOutstanding,
        totalExpenses,
        invoiceCount: invoices.length,
        quotationCount: quotations,
        customerCount: customers,
        overdueCount,
        revenueByMonth,
        topClients,
        recentInvoices: (invoices as any[]).slice(0, 5),
        paymentStatusBreakdown,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Failed to load dashboard" }, { status: 500 });
  }
}
