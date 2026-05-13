import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import { withLog } from "@/lib/logger";

export const POST = withLog("POST /api/projects/[id]/attachments", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const { url, name, type, size } = await req.json();
    if (!url || !name) return NextResponse.json({ success: false, error: "url and name required" }, { status: 400 });
    const project = await Project.findByIdAndUpdate(
      id,
      { $push: { attachments: { url, name, type: type || "application/octet-stream", size: size || 0, uploadedAt: new Date() } } },
      { new: true }
    ).lean();
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: (project as any).attachments });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/projects/[id]/attachments", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const { attachmentId } = await req.json();
    if (!isValidObjectId(id) || !attachmentId) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const project = await Project.findByIdAndUpdate(
      id,
      { $pull: { attachments: { _id: attachmentId } } },
      { new: true }
    ).lean();
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
