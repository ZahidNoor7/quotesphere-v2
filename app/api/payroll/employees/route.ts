import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import Employee from "@/models/Employee";

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

const bankSchema = z
  .object({
    bankName: z.string().max(120).optional(),
    accountTitle: z.string().max(120).optional(),
    accountNumber: z.string().max(60).optional(),
    iban: z.string().max(60).optional(),
  })
  .optional();

const employeeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  designation: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  employmentType: z.enum(["full_time", "contract"]).optional(),
  joinDate: z.string().min(1, "Join date is required"),
  status: z.enum(["active", "inactive"]).optional(),
  bankDetails: bankSchema,
  payCurrency: z.enum(CURRENCIES).optional(),
  salaryStructureId: z.string().optional().or(z.literal("")),
});

export const GET = withTenant("GET /api/payroll/employees", async (req: NextRequest, _ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const department = searchParams.get("department") || "";

    const query: Record<string, unknown> = {};
    if (search) query.$text = { $search: search };
    if (status === "active" || status === "inactive") query.status = status;
    if (department) query.department = department;

    const [total, data] = await Promise.all([
      Employee.countDocuments(query),
      Employee.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[payroll employees GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch employees" }, { status: 500 });
  }
});

export const POST = withTenant("POST /api/payroll/employees", async (req: NextRequest, _ctx, { session }) => {
  try {
    const denied = requireAdmin(session);
    if (denied) return denied;

    const parsed = employeeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const data: Record<string, unknown> = { ...parsed.data, joinDate: new Date(parsed.data.joinDate) };
    if (!data.salaryStructureId) delete data.salaryStructureId;
    if (!data.email) delete data.email;

    const employee = await Employee.create(data);
    void recordAudit({ req, session, action: "create", resource: "employee", resource_id: String(employee._id), resource_label: employee.employee_code, after: employee.toObject() });
    return NextResponse.json({ success: true, data: employee }, { status: 201 });
  } catch (err) {
    console.error("[payroll employees POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create employee" }, { status: 500 });
  }
});
