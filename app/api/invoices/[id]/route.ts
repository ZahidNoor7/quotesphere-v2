import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export const GET = withLog("GET /api/invoices/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: invoice });
  } catch (err) {
    console.error("[invoices/[id] GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch invoice" }, { status: 500 });
  }
});

export const PUT = withLog("PUT /api/invoices/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const parsed = z.record(z.string(), z.unknown()).safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    const invoice = await Invoice.findById(id);
    if (!invoice) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const before = invoice.toObject();
    Object.assign(invoice, parsed.data);
    await invoice.save();

    void recordAudit({ req, session, action: "update", resource: "invoice", resource_id: id, resource_label: before.invoice_no, before, after: invoice.toObject() });
    return NextResponse.json({ success: true, data: invoice });
  } catch (err: any) {
    console.error("[invoices/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/invoices/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const invoice = await Invoice.findById(id).lean() as any;
    await Invoice.findByIdAndDelete(id);

    void recordAudit({ req, session, action: "delete", resource: "invoice", resource_id: id, resource_label: invoice?.invoice_no ?? id, before: invoice });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[invoices/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
