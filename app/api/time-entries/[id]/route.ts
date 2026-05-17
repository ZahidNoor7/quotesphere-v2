import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import TimeEntry from "@/models/TimeEntry";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export const PUT = withLog("PUT /api/time-entries/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    const entry = await TimeEntry.findByIdAndUpdate(id, body, { new: true });
    if (!entry) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    void recordAudit({ req, session, action: "update", resource: "project", resource_id: String((entry as any).project_id), resource_label: `Time entry updated` });
    return NextResponse.json({ success: true, data: entry });
  } catch (err: any) {
    console.error("[time-entries/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/time-entries/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const entry = await TimeEntry.findById(id).lean() as any;
    await TimeEntry.findByIdAndDelete(id);
    void recordAudit({ req, session, action: "delete", resource: "project", resource_id: String(entry?.project_id ?? id), resource_label: `Time entry deleted` });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[time-entries/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
