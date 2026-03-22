import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Customer from "@/models/Customer";
import Expense from "@/models/Expense";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [invoices, quotations, customers, expenses] = await Promise.all([
      Invoice.find({ status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(100).lean(),
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

    // Revenue by month (last 6 months)
    const monthlyMap: Record<string, { revenue: number; received: number }> = {};
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = d.toLocaleString("default", { month: "short" });
      monthlyMap[key] = { revenue: 0, received: 0 };
    }
    (invoices as any[]).forEach((inv) => {
      const d = new Date(inv.issue_date);
      const mDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (mDiff >= 0 && mDiff <= 5) {
        const key = d.toLocaleString("default", { month: "short" });
        if (monthlyMap[key]) {
          monthlyMap[key].revenue += inv.total_amount;
          monthlyMap[key].received += inv.total_paid || 0;
        }
      }
    });
    const revenueByMonth = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

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
    (invoices as any[]).forEach((i) => { breakdown[i.payment_status as keyof typeof breakdown] = (breakdown[i.payment_status as keyof typeof breakdown] || 0) + 1; });
    const paymentStatusBreakdown = Object.entries(breakdown).map(([status, count]) => ({
      status, count,
      amount: (invoices as any[]).filter((i) => i.payment_status === status).reduce((s, i) => s + i.total_amount, 0),
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
