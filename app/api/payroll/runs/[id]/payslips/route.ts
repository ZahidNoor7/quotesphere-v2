import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import Payslip from "@/models/Payslip";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withTenant("GET /api/payroll/runs/[id]/payslips", async (_req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const data = await Payslip.find({ payrollRunId: id }).sort({ "employeeSnapshot.name": 1 }).lean();
  return NextResponse.json({ success: true, data });
});
