import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

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
    const data = await Product.find(query).sort({ category: 1, name: 1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/products", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const product = await Product.create(body);
    void recordAudit({ req, session, action: "create", resource: "product", resource_id: String(product._id), resource_label: product.name, after: product.toObject() });
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
