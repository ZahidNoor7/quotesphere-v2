import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const [project, invoices, quotations, expenses] = await Promise.all([
      Project.findById(id).lean(),
      Invoice.find({ project_id: id }).sort({ createdAt: -1 }).lean(),
      Quotation.find({ project_id: id }).sort({ createdAt: -1 }).lean(),
      Expense.find({ project_id: id }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const stats = {
      totalInvoiced: (invoices as any[]).reduce((s, i) => s + (i.total_amount || 0), 0),
      totalPaid: (invoices as any[]).reduce((s, i) => s + (i.total_paid || 0), 0),
      totalOutstanding: (invoices as any[]).reduce((s, i) => s + (i.outstanding || 0), 0),
      totalExpenses: (expenses as any[]).reduce((s, e) => s + (e.total_amount || 0), 0),
      invoiceCount: invoices.length,
      quotationCount: quotations.length,
      expenseCount: expenses.length,
    };
    return NextResponse.json({ success: true, data: { project, invoices, quotations, expenses, stats } });
  } catch { return NextResponse.json({ success: false, error: "Failed" }, { status: 500 }); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const data = await Project.findByIdAndUpdate(id, body, { new: true });
    return NextResponse.json({ success: true, data });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    await Project.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 }); }
}
