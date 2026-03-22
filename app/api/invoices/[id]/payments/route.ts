import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const { date, amount, method, reference, note } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid payment amount" }, { status: 400 });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

    invoice.payments.push({ date: new Date(date), amount, method, reference, note, createdAt: new Date() } as any);
    await invoice.save(); // pre-save hook recalculates totals

    return NextResponse.json({ success: true, data: invoice });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to record payment" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    const invoice = await Invoice.findById(id);
    if (!invoice) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    invoice.payments = invoice.payments.filter((p: any) => p._id?.toString() !== paymentId) as any;
    await invoice.save();

    return NextResponse.json({ success: true, data: invoice });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
