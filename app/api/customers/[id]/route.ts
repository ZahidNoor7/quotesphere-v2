import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const customer = await Customer.findById(id).lean();
    if (!customer) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const [invoices, quotations, expenses] = await Promise.all([
      Invoice.find({ customer_id: id }).sort({ createdAt: -1 }).lean(),
      Quotation.find({ customer_id: id }).sort({ createdAt: -1 }).lean(),
      Expense.find({ customer_id: id }).sort({ createdAt: -1 }).lean(),
    ]);

    const stats = {
      totalInvoiced: (invoices as any[]).reduce((s, i) => s + i.total_amount, 0),
      totalPaid: (invoices as any[]).reduce((s, i) => s + (i.total_paid || 0), 0),
      totalOutstanding: (invoices as any[]).reduce((s, i) => s + (i.outstanding || 0), 0),
      totalExpenses: (expenses as any[]).reduce((s, e) => s + e.total_amount, 0),
      invoiceCount: invoices.length,
      quotationCount: quotations.length,
    };

    return NextResponse.json({ success: true, data: { customer, invoices, quotations, expenses, stats } });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to fetch customer" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const customer = await Customer.findByIdAndUpdate(id, body, { new: true });
    if (!customer) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: customer });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    await Customer.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
