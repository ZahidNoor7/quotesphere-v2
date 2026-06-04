import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Customer from "@/models/Customer";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone_no: z.string().min(1, "Phone is required").max(50),
  email: z.email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  company: z.string().max(200).optional(),
  tax_id: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  status: z.boolean().optional(),
  currency: z.string().optional(),
});

export const GET = withTenant("GET /api/customers", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status === "active") query.status = true;
    if (status === "inactive") query.status = false;

    const total = await Customer.countDocuments(query);
    const data = await Customer.find(query)
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
    console.error("[customers GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch customers" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/customers", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const body = await req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const customer = await Customer.create(parsed.data);
    void recordAudit({ req, session, action: "create", resource: "customer", resource_id: String(customer._id), resource_label: customer.name, after: customer.toObject() });
    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (err: any) {
    console.error("[customers POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create customer" }, { status: 500 });
  }
});
