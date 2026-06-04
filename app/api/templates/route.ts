import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Template from "@/models/Template";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

export const GET = withTenant("GET /api/templates", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "";
    const query: Record<string, unknown> = {};
    if (type) query.$or = [{ type }, { type: "both" }];
    const data = await Template.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch templates" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/templates", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ success: false, error: "Template name is required" }, { status: 400 });
    const template = await Template.create(body);
    void recordAudit({ req, session, action: "create", resource: "template", resource_id: String(template._id), resource_label: template.name });
    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
