import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const milestoneSchema = z.object({
  name:        z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  due_date:    z.string().optional(),
  notes:       z.string().max(1000).optional(),
});

export const POST = withLog("POST /api/projects/[id]/milestones", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const parsed = milestoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { $push: { milestones: { ...parsed.data, due_date: parsed.data.due_date ? new Date(parsed.data.due_date) : undefined } } },
      { new: true }
    );
    if (!project) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

    const milestone = project.milestones?.[project.milestones.length - 1];
    void recordAudit({ req, session, action: "update", resource: "project", resource_id: id, resource_label: `Milestone added: ${parsed.data.name}` });
    return NextResponse.json({ success: true, data: milestone }, { status: 201 });
  } catch (err: any) {
    console.error("[projects/[id]/milestones POST]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
