import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Service from "@/models/Service";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export const PUT = withTenant("PUT /api/services/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const before = await Service.findById(id).lean() as any;
    const data = await Service.findByIdAndUpdate(id, body, { new: true });
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    void recordAudit({ req, session, action: "update", resource: "service", resource_id: id, resource_label: before?.name ?? id, before, after: data.toObject() });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[services/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/services/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const service = await Service.findById(id).lean() as any;
    await Service.findByIdAndDelete(id);
    void recordAudit({ req, session, action: "delete", resource: "service", resource_id: id, resource_label: service?.name ?? id, before: service });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[services/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
