import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { validateRichTextFields } from "@/lib/rich-text/zod";

export const GET = withTenant("GET /api/invoices/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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

export const PUT = withTenant("PUT /api/invoices/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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

    // Never let the client overwrite ownership or immutable identity fields.
    const data = { ...parsed.data };
    for (const k of ["org_id", "_id", "invoice_no", "createdAt", "updatedAt", "__v"]) {
      delete (data as Record<string, unknown>)[k];
    }

    const richErr = validateRichTextFields(data);
    if (richErr) return NextResponse.json({ success: false, error: richErr }, { status: 400 });

    const before = invoice.toObject();
    Object.assign(invoice, data);
    // `remarks` and line-item `description` are Mixed paths — flag them modified
    // so Mongoose persists object value changes on save().
    if ("remarks" in data) invoice.markModified("remarks");
    if ("items" in data) invoice.markModified("items");
    await invoice.save();

    void recordAudit({ req, session, action: "update", resource: "invoice", resource_id: id, resource_label: before.invoice_no, before, after: invoice.toObject() });
    return NextResponse.json({ success: true, data: invoice });
  } catch (err: any) {
    console.error("[invoices/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/invoices/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
