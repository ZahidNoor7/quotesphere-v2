import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const customer_id = searchParams.get("customer_id") || "";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (customer_id) query.customer_id = customer_id;

    const total = await Project.countDocuments(query);
    const data = await Project.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch { return NextResponse.json({ success: false, error: "Failed to fetch projects" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const project = new Project(body);
    await project.save();
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to create project" }, { status: 500 });
  }
}
