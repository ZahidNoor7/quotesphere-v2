import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import Employee from "@/models/Employee";
import Payslip from "@/models/Payslip";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  designation: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  employmentType: z.enum(["full_time", "contract"]).optional(),
  joinDate: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  bankDetails: z
    .object({
      bankName: z.string().max(120).optional(),
      accountTitle: z.string().max(120).optional(),
      accountNumber: z.string().max(60).optional(),
      iban: z.string().max(60).optional(),
    })
    .optional(),
  payCurrency: z.enum(CURRENCIES).optional(),
  salaryStructureId: z.string().optional().or(z.literal("")),
});

type Ctx = { params: Promise<{ id: string }> };

export const GET = withTenant("GET /api/payroll/employees/[id]", async (_req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
  const employee = await Employee.findById(id).lean();
  if (!employee) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: employee });
});

export const PUT = withTenant("PUT /api/payroll/employees/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });

    const employee = await Employee.findById(id);
    if (!employee) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.joinDate) data.joinDate = new Date(data.joinDate as string);
    if (data.salaryStructureId === "") data.salaryStructureId = undefined;
    if (data.email === "") data.email = undefined;

    const before = employee.toObject();
    Object.assign(employee, data);
    await employee.save();
    void recordAudit({ req, session, action: "update", resource: "employee", resource_id: id, resource_label: before.employee_code, before, after: employee.toObject() });
    return NextResponse.json({ success: true, data: employee });
  } catch (err) {
    console.error("[payroll employees PUT]", err);
    return NextResponse.json({ success: false, error: "Failed to update employee" }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/payroll/employees/[id]", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  // Employees with payslips are immutable financial subjects — deactivate, don't delete.
  const payslipCount = await Payslip.countDocuments({ employeeId: id });
  if (payslipCount > 0) {
    return NextResponse.json({ success: false, error: "This employee has payslips. Set their status to inactive instead of deleting." }, { status: 409 });
  }
  const employee = (await Employee.findById(id).lean()) as { employee_code?: string } | null;
  if (!employee) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await Employee.findByIdAndDelete(id);
  void recordAudit({ req, session, action: "delete", resource: "employee", resource_id: id, resource_label: employee.employee_code ?? id });
  return NextResponse.json({ success: true });
});
