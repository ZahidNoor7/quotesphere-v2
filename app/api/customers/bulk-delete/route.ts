import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  force: z.boolean().optional(),
});

export const POST = withLog("POST /api/customers/bulk-delete", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, "DELETE");
    if (denied) return denied;

    await connectDB();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    const { ids, force } = parsed.data;

    const deleted: { id: string; name: string }[] = [];
    const blocked: { id: string; name: string; invoiceCount: number; quotationCount: number; expenseCount: number }[] = [];

    for (const id of ids.filter((i) => isValidObjectId(i))) {
      const customer = (await Customer.findById(id).lean()) as { _id: unknown; name?: string } | null;
      if (!customer) continue; // already gone — treat as a no-op

      if (!force) {
        const [invoiceCount, quotationCount, expenseCount] = await Promise.all([
          Invoice.countDocuments({ customer_id: id }),
          Quotation.countDocuments({ customer_id: id }),
          Expense.countDocuments({ customer_id: id }),
        ]);
        if (invoiceCount + quotationCount + expenseCount > 0) {
          blocked.push({ id, name: customer.name ?? id, invoiceCount, quotationCount, expenseCount });
          continue;
        }
      }

      await Customer.findByIdAndDelete(id);
      void recordAudit({ req, session, action: "delete", resource: "customer", resource_id: id, resource_label: customer.name ?? id, before: customer });
      deleted.push({ id, name: customer.name ?? id });
    }

    return NextResponse.json({ success: true, data: { deleted, blocked } });
  } catch (err) {
    console.error("[customers bulk-delete]", err);
    return NextResponse.json({ success: false, error: "Bulk delete failed" }, { status: 500 });
  }
});
