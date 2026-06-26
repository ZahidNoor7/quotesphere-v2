import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Template from "@/models/Template";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

export const PUT = withTenant("PUT /api/templates/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const data = await Template.findByIdAndUpdate(id, body, { returnDocument: "after" });
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    void recordAudit({ req, session, action: "update", resource: "template", resource_id: id, resource_label: data.name });
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update template";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/templates/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const template = await Template.findById(id).lean() as any;
    await Template.findByIdAndDelete(id);
    void recordAudit({ req, session, action: "delete", resource: "template", resource_id: id, resource_label: template?.name ?? id });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 });
  }
});
