import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

export const GET = withTenant("GET /api/projects/[id]", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const [project, invoices, quotations, expenses] = await Promise.all([
      Project.findById(id).lean(),
      Invoice.find({ project_id: id }).sort({ createdAt: -1 }).lean(),
      Quotation.find({ project_id: id }).sort({ createdAt: -1 }).lean(),
      Expense.find({ project_id: id }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!project) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const stats = {
      totalInvoiced: (invoices as any[]).reduce((s, i) => s + (i.total_amount || 0), 0),
      totalPaid: (invoices as any[]).reduce((s, i) => s + (i.total_paid || 0), 0),
      totalOutstanding: (invoices as any[]).reduce((s, i) => s + (i.outstanding || 0), 0),
      totalExpenses: (expenses as any[]).reduce((s, e) => s + (e.total_amount || 0), 0),
      invoiceCount: invoices.length,
      quotationCount: quotations.length,
      expenseCount: expenses.length,
    };
    return NextResponse.json({ success: true, data: { project, invoices, quotations, expenses, stats } });
  } catch (err) {
    console.error("[projects/[id] GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch project" }, { status: 500 });
  }
});

export const PUT = withTenant("PUT /api/projects/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    const body = await req.json();
    // Strip ownership/identity fields so a client can't reassign or overwrite them.
    for (const k of ["org_id", "_id", "project_no", "createdAt", "updatedAt", "__v"]) delete body[k];
    const before = await Project.findById(id).lean() as any;
    const data = await Project.findByIdAndUpdate(id, body, { new: true });
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    void recordAudit({ req, session, action: "update", resource: "project", resource_id: id, resource_label: before?.name ?? id, before, after: data.toObject() });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[projects/[id] PUT]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withTenant("DELETE /api/projects/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    if (!force) {
      const [invoiceCount, quotationCount, expenseCount] = await Promise.all([
        Invoice.countDocuments({ project_id: id }),
        Quotation.countDocuments({ project_id: id }),
        Expense.countDocuments({ project_id: id }),
      ]);
      const total = invoiceCount + quotationCount + expenseCount;
      if (total > 0) {
        return NextResponse.json({
          success: false,
          error: `Cannot delete project with ${total} linked record(s). Use force=true to delete anyway.`,
          details: { invoiceCount, quotationCount, expenseCount },
        }, { status: 409 });
      }
    }

    const project = await Project.findById(id).lean() as any;
    await Project.findByIdAndDelete(id);
    void recordAudit({ req, session, action: "delete", resource: "project", resource_id: id, resource_label: project?.name ?? id, before: project });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[projects/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
});
