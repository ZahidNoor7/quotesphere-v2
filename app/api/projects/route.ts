import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["pending", "in_progress", "on_hold", "cancelled", "complete"] as const).optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  budget: z.number().min(0).optional(),
  currency: z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const).optional(),
  customer_id: z.string().min(1, "Customer is required"),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  progress: z.number().min(0).max(100).optional(),
});

export const GET = withTenant("GET /api/projects", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const customer_id = searchParams.get("customer_id") || "";
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (customer_id) query.customer_id = customer_id;

    const sortObj: any = { [sort]: order === "asc" ? 1 : -1 };
    const total = await Project.countDocuments(query);
    const data = await Project.find(query).sort(sortObj).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[projects GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch projects" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/projects", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const body = await req.json();
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const project = new Project(parsed.data);
    await project.save();
    void recordAudit({ req, session, action: "create", resource: "project", resource_id: String(project._id), resource_label: project.name, after: project.toObject() });
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (err: any) {
    console.error("[projects POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create project" }, { status: 500 });
  }
});
