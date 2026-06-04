import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Product from "@/models/Product";
import Settings from "@/models/Settings";
import { getNextNumberWithPattern } from "@/models/Counter";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const itemSchema = z.object({
  id: z.number(),
  name: z.string().max(500),
  quantity: z.number().min(0),
  price: z.number().min(0),
  images: z.array(z.string()).optional(),
  product_id: z.string().optional(),
});

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;
const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "online", "cheque"] as const;

const invoiceSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  issue_date: z.string().nullable().transform(v => v ?? new Date().toISOString().slice(0, 10)),
  due_date: z.string().optional(),
  status: z.enum(["draft", "issued", "cancelled"] as const).optional(),
  payment_status: z.enum(["pending", "partial", "complete"] as const).optional(),
  payment_mode: z.enum(PAYMENT_METHODS).optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  sub_total: z.number().min(0),
  total_amount: z.number().min(0),
  outstanding: z.number().min(0).optional(),
  total_paid: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  tax_type: z.enum(["percentage", "value"] as const).optional(),
  discount: z.number().min(0).optional(),
  delivery_charges: z.number().min(0).optional(),
  advance: z.number().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  remarks: z.string().max(2000).optional(),
  project_id: z.string().optional(),
  converted_from: z.string().optional(),
  designId: z.string().optional(),
  rateSnapshot: z.record(z.string(), z.number()).optional(),
  delivery_status: z.enum(["pending", "shipped", "delivered"] as const).optional(),
  tracking_no: z.string().optional(),
});

export const GET = withTenant("GET /api/invoices", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const payment_status = searchParams.get("payment_status") || "";
    const customer_id = searchParams.get("customer_id") || "";
    const project_id = searchParams.get("project_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (payment_status) query.payment_status = payment_status;
    if (customer_id) query.customer_id = customer_id;
    if (project_id) query.project_id = project_id;
    if (from || to) {
      query.issue_date = {};
      if (from) query.issue_date.$gte = new Date(from);
      if (to) query.issue_date.$lte = new Date(to);
    }

    const total = await Invoice.countDocuments(query);
    const data = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[invoices GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/invoices", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const body = await req.json();
    const parsed = invoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }

    // Fetch user settings to get prefix and pattern, then pre-generate the number
    // so the model pre-save hook skips generation (it only generates when invoice_no is missing)
    const orgSettings = await Settings.findOne({}).lean() as any;
    const prefix  = orgSettings?.invoice_prefix ?? "INV";
    const pattern = orgSettings?.invoice_number_pattern ?? null;
    const invoice_no = await getNextNumberWithPattern((session.user as any).org_id, "invoice", prefix, pattern);

    const invoice = new Invoice({ ...parsed.data, invoice_no });
    await invoice.save();
    void recordAudit({ req, session, action: "create", resource: "invoice", resource_id: String(invoice._id), resource_label: invoice_no, after: invoice.toObject() });

    // Decrement stock for any items linked to a catalog product
    const stockOps = (parsed.data.items ?? [])
      .filter((item: any) => item.product_id && item.quantity > 0)
      .map((item: any) =>
        Product.findByIdAndUpdate(item.product_id, {
          $inc: { stock_qty: -Math.abs(item.quantity) },
        })
      );
    if (stockOps.length) await Promise.all(stockOps);

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (err: any) {
    console.error("[invoices POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create invoice" }, { status: 500 });
  }
});
