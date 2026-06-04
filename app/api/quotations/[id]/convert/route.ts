import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Quotation from "@/models/Quotation";
import Invoice from "@/models/Invoice";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

export const POST = withTenant("POST /api/quotations/[id]/convert", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const { selectedItemIds, issue_date, due_date, payment_mode, currency, project_id, remarks } = await req.json();

    const quotation = await Quotation.findById(id);
    if (!quotation) return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    if (quotation.status === "invoiced") return NextResponse.json({ success: false, error: "Already converted" }, { status: 400 });

    const items = selectedItemIds?.length
      ? quotation.items.filter((item: any) => selectedItemIds.includes(item.id))
      : quotation.items;

    const sub_total = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    const taxAmt = quotation.tax_type === "percentage" ? (sub_total * quotation.tax) / 100 : quotation.tax;
    const total_amount = sub_total + taxAmt + (quotation.delivery_charges || 0) - (quotation.discount || 0);

    const invoice = new Invoice({
      issue_date: issue_date ? new Date(issue_date) : new Date(),
      due_date: due_date ? new Date(due_date) : undefined,
      status: "issued",
      payment_mode: payment_mode || "cash",
      items,
      sub_total,
      tax: quotation.tax,
      tax_type: quotation.tax_type,
      discount: quotation.discount || 0,
      delivery_charges: quotation.delivery_charges || 0,
      total_amount,
      advance: 0,
      balance: total_amount,
      outstanding: total_amount,
      total_paid: 0,
      currency: currency || quotation.currency,
      remarks: remarks || `Converted from ${quotation.quotation_no}`,
      customer_id: quotation.customer_id,
      customer_name: quotation.customer_name,
      customer_phone: quotation.customer_phone,
      customer_address: quotation.customer_address,
      project_id: project_id || quotation.project_id,
      converted_from: quotation._id,
    });

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        await invoice.save({ session: dbSession });
        quotation.status = "invoiced";
        quotation.converted_to = invoice._id as any;
        await quotation.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    void recordAudit({ req, session, action: "create", resource: "invoice", resource_id: String(invoice._id), resource_label: (invoice as any).invoice_no ?? "converted", after: { converted_from: (quotation as any).quotation_no } });
    void recordAudit({ req, session, action: "update", resource: "quotation", resource_id: id, resource_label: (quotation as any).quotation_no, after: { status: "invoiced", converted_to: String(invoice._id) } });
    return NextResponse.json({ success: true, data: { invoice, quotation } });
  } catch (err: any) {
    console.error("[quotation convert]", err);
    return NextResponse.json({ success: false, error: err.message || "Conversion failed" }, { status: 500 });
  }
});
