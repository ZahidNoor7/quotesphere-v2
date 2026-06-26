import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

// Explicit allow-list — never spread the raw body into the model (org_id must
// only come from the tenant context, not caller input).
const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  unit: z.string().max(50).optional(),
  default_price: z.coerce.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  stock_qty: z.coerce.number().min(0).optional(),
  low_stock_threshold: z.coerce.number().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const GET = withTenant("GET /api/products", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const lowStock = searchParams.get("low_stock") === "true";
    const status = searchParams.get("status") || "active";
    const query: Record<string, unknown> = {};
    // `status` is compared against fixed literals — never interpolated into the query.
    if (status === "active") query.is_active = true;
    else if (status === "inactive") query.is_active = false;
    // status === "all" → no is_active constraint
    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (lowStock) query.$expr = { $lte: ["$stock_qty", "$low_stock_threshold"] };
    // Hard cap bounds memory/latency (the picker UIs need the full catalog, so we
    // cap high rather than page); add ?limit/&page for explicit pagination.
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "1000")));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const data = await Product.find(query).sort({ category: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/products", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const parsed = productSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const product = await Product.create(parsed.data);
    void recordAudit({ req, session, action: "create", resource: "product", resource_id: String(product._id), resource_label: product.name, after: product.toObject() });
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
