import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const customerUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone_no: z.string().min(1).max(50).optional(),
  email: z.email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  company: z.string().max(200).optional(),
  tax_id: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  status: z.boolean().optional(),
  currency: z.string().optional(),
});

export const GET = withTenant("GET /api/customers/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

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
    console.error("[customers/[id] GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch customer" }, { status: 500 });
  }
});

export const PUT = withTenant("PUT /api/customers/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const before = await Customer.findById(id).lean() as any;
    const customer = await Customer.findByIdAndUpdate(id, parsed.data, { new: true });
    if (!customer) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    void recordAudit({ req, session, action: "update", resource: "customer", resource_id: id, resource_label: before?.name ?? id, before, after: customer.toObject() });
    return NextResponse.json({ success: true, data: customer });
  } catch (err: any) {
    console.error("[customers/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/customers/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const denied = requireRole(session, req.method);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    if (!force) {
      const [invoiceCount, quotationCount, expenseCount] = await Promise.all([
        Invoice.countDocuments({ customer_id: id }),
        Quotation.countDocuments({ customer_id: id }),
        Expense.countDocuments({ customer_id: id }),
      ]);
      const total = invoiceCount + quotationCount + expenseCount;
      if (total > 0) {
        return NextResponse.json({
          success: false,
          error: `Cannot delete customer with ${total} linked record(s). Use force=true to delete anyway.`,
          details: { invoiceCount, quotationCount, expenseCount },
        }, { status: 409 });
      }
    }

    const customer = await Customer.findById(id).lean() as any;
    await Customer.findByIdAndDelete(id);
    void recordAudit({ req, session, action: "delete", resource: "customer", resource_id: id, resource_label: customer?.name ?? id, before: customer });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[customers/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
