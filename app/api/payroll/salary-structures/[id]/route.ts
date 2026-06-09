import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import SalaryStructure from "@/models/SalaryStructure";
import Employee from "@/models/Employee";
import { structureSchema } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withTenant("GET /api/payroll/salary-structures/[id]", async (_req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const structure = await SalaryStructure.findById(id).lean();
  if (!structure) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: structure });
});

export const PUT = withTenant("PUT /api/payroll/salary-structures/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const parsed = structureSchema.partial().safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });

    const structure = await SalaryStructure.findById(id);
    if (!structure) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const before = structure.toObject();
    Object.assign(structure, parsed.data);
    await structure.save();
    void recordAudit({ req, session, action: "update", resource: "salary_structure", resource_id: id, resource_label: structure.name, before, after: structure.toObject() });
    return NextResponse.json({ success: true, data: structure });
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: number };
    if (e.name === "ValidationError") return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    if (e.code === 11000) return NextResponse.json({ success: false, error: "A salary structure with this name already exists" }, { status: 409 });
    console.error("[salary-structures PUT]", err);
    return NextResponse.json({ success: false, error: "Failed to update salary structure" }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/payroll/salary-structures/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  const assigned = await Employee.countDocuments({ salaryStructureId: id });
  if (assigned > 0) {
    return NextResponse.json({ success: false, error: `This structure is assigned to ${assigned} employee(s). Reassign them first.` }, { status: 409 });
  }
  const structure = (await SalaryStructure.findById(id).lean()) as { name?: string } | null;
  if (!structure) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await SalaryStructure.findByIdAndDelete(id);
  void recordAudit({ req, session, action: "delete", resource: "salary_structure", resource_id: id, resource_label: structure.name ?? id });
  return NextResponse.json({ success: true });
});
