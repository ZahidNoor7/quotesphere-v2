import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Template from "@/models/Template";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const templateItemSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(300),
  quantity: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
});

// Explicit allow-list — never spread the raw body (org_id is context-only).
const templateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  type: z.enum(["invoice", "quotation", "both"]).optional(),
  items: z.array(templateItemSchema).max(200).optional(),
  tax: z.coerce.number().min(0).optional(),
  tax_type: z.enum(["percentage", "value"]).optional(),
  discount: z.coerce.number().min(0).optional(),
  delivery_charges: z.coerce.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  remarks: z.string().max(5000).optional(),
  payment_mode: z.string().max(50).optional(),
  designId: z.string().max(100).optional(),
});

export const GET = withTenant("GET /api/templates", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "";
    const query: Record<string, unknown> = {};
    if (type) query.$or = [{ type }, { type: "both" }];
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "1000")));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const data = await Template.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch templates" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/templates", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const parsed = templateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const template = await Template.create(parsed.data);
    void recordAudit({ req, session, action: "create", resource: "template", resource_id: String(template._id), resource_label: template.name });
    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
