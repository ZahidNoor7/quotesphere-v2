import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Service from "@/models/Service";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  default_price: z.number().min(0).optional(),
  currency: z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const).optional(),
  unit: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
});

export const GET = withTenant("GET /api/services", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "active";
    const query: any = {};
    // `status` is compared against fixed literals — never interpolated into the query.
    if (status === "active") query.is_active = true;
    else if (status === "inactive") query.is_active = false;
    // status === "all" → no is_active constraint
    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "1000")));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const data = await Service.find(query).sort({ category: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch services" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/services", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const body = await req.json();
    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const service = await Service.create(parsed.data);
    void recordAudit({ req, session, action: "create", resource: "service", resource_id: String(service._id), resource_label: service.name, after: service.toObject() });
    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to create service" }, { status: 500 });
  }
});
