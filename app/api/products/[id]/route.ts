import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { withLog } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";

export const GET = withLog("GET /api/products/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const data = await Product.findById(id).lean();
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch product" }, { status: 500 });
  }
});

export const PUT = withLog("PUT /api/products/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const before = await Product.findById(id).lean() as any;
    const data = await Product.findByIdAndUpdate(id, body, { new: true });
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    void recordAudit({ req, session, action: "update", resource: "product", resource_id: id, resource_label: before?.name ?? id, before, after: data.toObject() });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update product";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/products/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const product = await Product.findById(id).lean() as any;
    await Product.findByIdAndDelete(id);
    void recordAudit({ req, session, action: "delete", resource: "product", resource_id: id, resource_label: product?.name ?? id, before: product });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete product" }, { status: 500 });
  }
});
