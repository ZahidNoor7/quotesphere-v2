import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { withTenant } from "@/lib/with-tenant";
import { requireAdmin } from "@/lib/payroll/guard";
import { recordAudit } from "@/lib/audit";
import PayrollRun from "@/models/PayrollRun";

type Ctx = { params: Promise<{ id: string }> };

// draft → pending_approval. Atomic via a status-filtered update so double-clicks
// can't advance twice.
export const POST = withTenant("POST /api/payroll/runs/[id]/submit", async (req: NextRequest, { params }: Ctx, { session }) => {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

  const run = await PayrollRun.findOneAndUpdate({ _id: id, status: "draft" }, { $set: { status: "pending_approval" } }, { returnDocument: "after" });
  if (!run) {
    const exists = await PayrollRun.findById(id).select("_id").lean();
    return NextResponse.json({ success: false, error: exists ? "Only a draft run can be submitted" : "Not found" }, { status: exists ? 409 : 404 });
  }
  void recordAudit({ req, session, action: "update", resource: "payroll_run", resource_id: id, resource_label: run.run_no, after: { status: "pending_approval" } });
  return NextResponse.json({ success: true, data: run });
});
