import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; milestoneId: string }> };

// PUT — update fields (name, due_date, notes, mark complete/incomplete, link invoice)
export const PUT = withTenant("PUT /api/projects/[id]/milestones/[milestoneId]", async (req: NextRequest, { params }: Params) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const { id, milestoneId } = await params;
    if (!isValidObjectId(id) || !isValidObjectId(milestoneId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();

    // Build $set targeting the matching milestone sub-document
    const setFields: Record<string, any> = {};
    if (body.name        !== undefined) setFields["milestones.$.name"]        = body.name;
    if (body.description !== undefined) setFields["milestones.$.description"] = body.description;
    if (body.notes       !== undefined) setFields["milestones.$.notes"]       = body.notes;
    if (body.due_date    !== undefined) setFields["milestones.$.due_date"]    = body.due_date ? new Date(body.due_date) : null;
    if (body.invoice_id  !== undefined) setFields["milestones.$.invoice_id"]  = body.invoice_id || null;
    if (body.completed !== undefined) {
      setFields["milestones.$.completed_at"] = body.completed ? new Date() : null;
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, "milestones._id": milestoneId },
      { $set: setFields },
      { new: true }
    );
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const milestone = (project.milestones ?? []).find((m: any) => String(m._id) === milestoneId);
    void recordAudit({ req, session, action: "update", resource: "project", resource_id: id, resource_label: `Milestone updated: ${(milestone as any)?.name ?? milestoneId}` });
    return NextResponse.json({ success: true, data: milestone });
  } catch (err: any) {
    console.error("[projects/[id]/milestones/[milestoneId] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

// DELETE — remove milestone from array
export const DELETE = withTenant("DELETE /api/projects/[id]/milestones/[milestoneId]", async (req: NextRequest, { params }: Params) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const { id, milestoneId } = await params;
    if (!isValidObjectId(id) || !isValidObjectId(milestoneId)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { $pull: { milestones: { _id: milestoneId } } },
      { new: true }
    );
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    void recordAudit({ req, session, action: "update", resource: "project", resource_id: id, resource_label: `Milestone deleted: ${milestoneId}` });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[projects/[id]/milestones/[milestoneId] DELETE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
