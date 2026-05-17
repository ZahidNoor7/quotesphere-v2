import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Quotation from "@/models/Quotation";
import Settings from "@/models/Settings";
import { getNextNumberWithPattern } from "@/models/Counter";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

const quotationSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  customer_address: z.string().optional(),
  issue_date: z.string().min(1),
  valid_until: z.string().optional(),
  status: z.enum(["draft", "pending", "approved", "rejected", "cancelled", "invoiced", "expired"] as const).optional(),
  items: z.array(z.object({
    id: z.number(),
    name: z.string().max(500),
    quantity: z.number().min(0),
    price: z.number().min(0),
  })).min(1, "At least one item is required"),
  tax: z.number().min(0).optional(),
  tax_type: z.enum(["percentage", "value"] as const).optional(),
  discount: z.number().min(0).optional(),
  delivery_charges: z.number().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  remarks: z.string().max(2000).optional(),
  project_id: z.string().optional(),
  designId: z.string().optional(),
  rateSnapshot: z.record(z.string(), z.number()).optional(),
});

export const GET = withLog("GET /api/quotations", async (req: NextRequest) => {
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
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (customer_id) query.customer_id = customer_id;
    if (project_id) query.project_id = project_id;
    if (from || to) {
      query.issue_date = {};
      if (from) query.issue_date.$gte = new Date(from);
      if (to) query.issue_date.$lte = new Date(to);
    }

    await Quotation.updateMany(
      { status: "pending", valid_until: { $lt: new Date() } },
      { $set: { status: "expired" } }
    );

    const total = await Quotation.countDocuments(query);
    const data = await Quotation.find(query)
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
    console.error("[quotations GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch quotations" }, { status: 500 });
  }
});

export const POST = withLog("POST /api/quotations", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const body = await req.json();
    const parsed = quotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const userSettings = await Settings.findOne({ user_id: (session.user as any)?.id }).lean() as any;
    const prefix  = userSettings?.quotation_prefix ?? "QT";
    const pattern = userSettings?.quotation_number_pattern ?? null;
    const quotation_no = await getNextNumberWithPattern("quotation", prefix, pattern);

    const quotation = new Quotation({ ...parsed.data, quotation_no });
    await quotation.save();
    return NextResponse.json({ success: true, data: quotation }, { status: 201 });
  } catch (err: any) {
    console.error("[quotations POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create quotation" }, { status: 500 });
  }
});
