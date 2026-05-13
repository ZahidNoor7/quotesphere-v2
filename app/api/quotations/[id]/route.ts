import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Quotation from "@/models/Quotation";
import Invoice from "@/models/Invoice";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";

export const GET = withLog("GET /api/quotations/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    await Quotation.updateOne(
      { _id: id, status: "pending", valid_until: { $lt: new Date() } },
      { $set: { status: "expired" } }
    );
    const data = await Quotation.findById(id).lean();
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[quotations/[id] GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch quotation" }, { status: 500 });
  }
});

export const PUT = withLog("PUT /api/quotations/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const data = await Quotation.findByIdAndUpdate(id, body, { new: true });
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[quotations/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/quotations/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const quotation = await Quotation.findById(id).lean() as any;
    if (quotation?.converted_to) {
      // Clear the back-reference on the derived invoice so it doesn't point to a deleted quotation
      await Invoice.findByIdAndUpdate(quotation.converted_to, { $unset: { converted_from: 1 } });
    }

    await Quotation.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[quotations/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
