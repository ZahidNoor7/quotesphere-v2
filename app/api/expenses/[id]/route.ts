import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Expense from "@/models/Expense";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export const GET = withTenant("GET /api/expenses/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const data = await Expense.findById(id).lean();
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[expenses/[id] GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch expense" }, { status: 500 });
  }
});

export const PUT = withTenant("PUT /api/expenses/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const before = await Expense.findById(id).lean() as any;
    const data = await Expense.findByIdAndUpdate(id, body, { returnDocument: "after" });
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    void recordAudit({ req, session, action: "update", resource: "expense", resource_id: id, resource_label: before?.expense_no ?? id, before, after: data.toObject() });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[expenses/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/expenses/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const expense = await Expense.findById(id).lean() as any;
    await Expense.findByIdAndDelete(id);

    void recordAudit({ req, session, action: "delete", resource: "expense", resource_id: id, resource_label: expense?.expense_no ?? id, before: expense });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[expenses/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
