import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";
import Project from "@/models/Project";
import Customer from "@/models/Customer";
import Service from "@/models/Service";
import Settings from "@/models/Settings";
import Counter from "@/models/Counter";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

const VALID_TYPES = ["invoices", "quotations", "expenses", "projects", "customers", "services", "all"] as const;
type DeleteType = (typeof VALID_TYPES)[number];

export const DELETE = withTenant("DELETE /api/settings/bulk-delete", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as DeleteType | null;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({
        success: false,
        error: "Invalid type. Use: invoices, quotations, expenses, projects, customers, services, or all",
      }, { status: 400 });
    }

    await connectDB();

    const results: Record<string, number> = {};

    if (type === "invoices" || type === "all") {
      results.invoices = (await Invoice.deleteMany({})).deletedCount;
    }
    if (type === "quotations" || type === "all") {
      results.quotations = (await Quotation.deleteMany({})).deletedCount;
    }
    if (type === "expenses" || type === "all") {
      results.expenses = (await Expense.deleteMany({})).deletedCount;
    }
    if (type === "projects" || type === "all") {
      results.projects = (await Project.deleteMany({})).deletedCount;
    }
    if (type === "customers" || type === "all") {
      results.customers = (await Customer.deleteMany({})).deletedCount;
    }
    if (type === "services" || type === "all") {
      results.services = (await Service.deleteMany({})).deletedCount;
    }
    if (type === "all") {
      await Counter.deleteMany({});
      await Settings.findOneAndUpdate(
        {},
        {
          $set: {
            company_name: "My Company", company_email: "", company_phone: "",
            company_address: "", company_logo: "", default_currency: "PKR",
            invoice_prefix: "INV", quotation_prefix: "QT", expense_prefix: "EXP",
            default_tax: 0, default_payment_terms: 30, terms_and_conditions: "",
            documentDesigns: [], "lastUsed.currency": "PKR", "lastUsed.paymentMethod": "cash",
          }
        },
        { upsert: true }
      );
    }

    void recordAudit({
      req, session,
      action: "delete",
      resource: "settings",
      resource_id: userId,
      resource_label: `Bulk delete: ${type}`,
      before: results,
    });
    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
