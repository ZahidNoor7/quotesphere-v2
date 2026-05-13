import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Expense from "@/models/Expense";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

const expenseSchema = z.object({
  bill_date: z.string().min(1, "Bill date is required"),
  vendor_name: z.string().max(200).optional(),
  bill_number: z.string().max(100).optional(),
  status: z.enum(["draft", "recorded", "verified", "cancelled"] as const).optional(),
  payment_status: z.enum(["pending", "paid", "partial"] as const).optional(),
  payment_method: z.enum(["cash", "bank_transfer", "card", "online", "cheque"] as const).optional(),
  items: z.array(z.object({
    id: z.number(),
    name: z.string().max(500),
    quantity: z.number().min(0),
    unit_price: z.number().min(0),
    total: z.number().min(0),
    category: z.string().optional(),
  })).min(1, "At least one item is required"),
  tax: z.number().min(0).optional(),
  tax_type: z.enum(["percentage", "value"] as const).optional(),
  discount: z.number().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  notes: z.string().max(2000).optional(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  project_id: z.string().optional(),
  rateSnapshot: z.record(z.string(), z.number()).optional(),
});

export const GET = withLog("GET /api/expenses", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const customer_id = searchParams.get("customer_id") || "";
    const project_id = searchParams.get("project_id") || "";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (customer_id) query.customer_id = customer_id;
    if (project_id) query.project_id = project_id;

    const total = await Expense.countDocuments(query);
    const data = await Expense.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[expenses GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch expenses" }, { status: 500 });
  }
});

export const POST = withLog("POST /api/expenses", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const body = await req.json();
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const expense = new Expense(parsed.data);
    await expense.save();
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (err: any) {
    console.error("[expenses POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create expense" }, { status: 500 });
  }
});
