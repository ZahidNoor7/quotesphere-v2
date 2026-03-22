import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const data = await Project.findById(id).lean();
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch { return NextResponse.json({ success: false, error: "Failed" }, { status: 500 }); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const data = await Project.findByIdAndUpdate(id, body, { new: true });
    return NextResponse.json({ success: true, data });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    await Project.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 }); }
}
