import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import { withTenant } from "@/lib/with-tenant";

export const POST = withTenant("POST /api/projects/[id]/notes", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const { content } = await req.json();
    if (!content?.trim()) return NextResponse.json({ success: false, error: "Content required" }, { status: 400 });
    const project = await Project.findByIdAndUpdate(
      id,
      { $push: { project_notes: { content: content.trim() } } },
      { new: true }
    ).lean();
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: (project as any).project_notes });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/projects/[id]/notes", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const { noteId } = await req.json();
    if (!isValidObjectId(id) || !noteId) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const project = await Project.findByIdAndUpdate(
      id,
      { $pull: { project_notes: { _id: noteId } } },
      { new: true }
    ).lean();
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
