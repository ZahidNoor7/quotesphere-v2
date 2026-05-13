import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import Expense from "@/models/Expense";
import Customer from "@/models/Customer";
import * as XLSX from "xlsx";

function dateFilter(from?: string, to?: string) {
  const q: Record<string, Date> = {};
  if (from) q.$gte = new Date(from);
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); q.$lte = d; }
  return Object.keys(q).length ? q : undefined;
}

function fmtDate(d: Date | string | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtNum(n: number | undefined) { return Number(n ?? 0).toFixed(2); }

// ─── CSV builder ──────────────────────────────────────────────────────────────
function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
}

// ─── Row builders ─────────────────────────────────────────────────────────────
function invoiceRows(docs: any[]) {
  const headers = ["Invoice #","Issue Date","Due Date","Client","Status","Payment","Currency","Sub Total","Tax","Discount","Delivery","Total","Paid","Outstanding","Payment Mode"];
  const rows = docs.map(i => [
    i.invoice_no, fmtDate(i.issue_date), fmtDate(i.due_date), i.customer_name,
    i.status, i.payment_status, i.currency,
    fmtNum(i.sub_total), fmtNum(i.tax), fmtNum(i.discount), fmtNum(i.delivery_charges),
    fmtNum(i.total_amount), fmtNum(i.total_paid), fmtNum(i.outstanding), i.payment_mode ?? "",
  ]);
  return { headers, rows };
}

function quotationRows(docs: any[]) {
  const headers = ["Quotation #","Issue Date","Valid Until","Client","Status","Currency","Sub Total","Tax","Discount","Delivery","Total"];
  const rows = docs.map(q => [
    q.quotation_no, fmtDate(q.issue_date), fmtDate(q.valid_until), q.customer_name,
    q.status, q.currency,
    fmtNum(q.sub_total), fmtNum(q.tax), fmtNum(q.discount), fmtNum(q.delivery_charges), fmtNum(q.total_amount),
  ]);
  return { headers, rows };
}

function expenseRows(docs: any[]) {
  const headers = ["Expense #","Bill Date","Vendor","Client","Status","Payment","Currency","Sub Total","Tax","Discount","Total"];
  const rows = docs.map(e => [
    e.expense_no, fmtDate(e.bill_date), e.vendor_name ?? "", e.customer_name,
    e.status, e.payment_status, e.currency,
    fmtNum(e.sub_total), fmtNum(e.tax), fmtNum(e.discount), fmtNum(e.total_amount),
  ]);
  return { headers, rows };
}

function customerRows(docs: any[]) {
  const headers = ["Name","Company","Email","Phone","Address","Currency","Status","Created"];
  const rows = docs.map(c => [
    c.name, c.company ?? "", c.email ?? "", c.phone_no ?? "", c.address ?? "",
    c.currency ?? "PKR", c.status ? "Active" : "Inactive", fmtDate(c.createdAt),
  ]);
  return { headers, rows };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(req.url);
    const module = searchParams.get("module") ?? "invoices";
    const format = searchParams.get("format") ?? "csv";
    const from   = searchParams.get("from") ?? "";
    const to     = searchParams.get("to") ?? "";
    const customerId = searchParams.get("customer_id") ?? "";

    // Build date query for date-bearing models
    const dateQ = dateFilter(from, to);

    if (format === "csv") {
      let csv = "";
      let filename = "";

      if (module === "invoices") {
        const q: Record<string, unknown> = {};
        if (dateQ) q.issue_date = dateQ;
        if (customerId) q.customer_id = customerId;
        const docs = await Invoice.find(q).sort({ issue_date: -1 }).limit(10000).lean();
        const { headers, rows } = invoiceRows(docs);
        csv = toCSV(headers, rows);
        filename = "invoices.csv";
      } else if (module === "quotations") {
        const q: Record<string, unknown> = {};
        if (dateQ) q.issue_date = dateQ;
        if (customerId) q.customer_id = customerId;
        const docs = await Quotation.find(q).sort({ issue_date: -1 }).limit(10000).lean();
        const { headers, rows } = quotationRows(docs);
        csv = toCSV(headers, rows);
        filename = "quotations.csv";
      } else if (module === "expenses") {
        const q: Record<string, unknown> = {};
        if (dateQ) q.bill_date = dateQ;
        if (customerId) q.customer_id = customerId;
        const docs = await Expense.find(q).sort({ bill_date: -1 }).limit(10000).lean();
        const { headers, rows } = expenseRows(docs);
        csv = toCSV(headers, rows);
        filename = "expenses.csv";
      } else if (module === "customers") {
        const docs = await Customer.find({}).sort({ name: 1 }).limit(10000).lean();
        const { headers, rows } = customerRows(docs);
        csv = toCSV(headers, rows);
        filename = "customers.csv";
      } else {
        return NextResponse.json({ error: "Unknown module" }, { status: 400 });
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "xlsx") {
      // Fetch all four modules in parallel
      const invoiceQ: Record<string, unknown> = {};
      const quotationQ: Record<string, unknown> = {};
      const expenseQ: Record<string, unknown> = {};
      if (dateQ) { invoiceQ.issue_date = dateQ; quotationQ.issue_date = dateQ; expenseQ.bill_date = dateQ; }

      const [invoices, quotations, expenses, customers] = await Promise.all([
        Invoice.find(invoiceQ).sort({ issue_date: -1 }).limit(10000).lean(),
        Quotation.find(quotationQ).sort({ issue_date: -1 }).limit(10000).lean(),
        Expense.find(expenseQ).sort({ bill_date: -1 }).limit(10000).lean(),
        Customer.find({}).sort({ name: 1 }).limit(10000).lean(),
      ]);

      const wb = XLSX.utils.book_new();

      function addSheet(name: string, headers: string[], rows: (string | number)[][]) {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        // Column widths based on header lengths
        ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
        XLSX.utils.book_append_sheet(wb, ws, name);
      }

      const invData = invoiceRows(invoices);
      addSheet("Invoices", invData.headers, invData.rows);

      const qtData = quotationRows(quotations);
      addSheet("Quotations", qtData.headers, qtData.rows);

      const expData = expenseRows(expenses);
      addSheet("Expenses", expData.headers, expData.rows);

      const custData = customerRows(customers);
      addSheet("Customers", custData.headers, custData.rows);

      // Summary sheet
      const totalRevenue   = invoices.reduce((s, i: any) => s + (i.total_amount ?? 0), 0);
      const totalCollected = invoices.reduce((s, i: any) => s + (i.total_paid ?? 0), 0);
      const totalOutstanding = invoices.reduce((s, i: any) => s + (i.outstanding ?? 0), 0);
      const totalExpenses  = expenses.reduce((s, e: any) => s + (e.total_amount ?? 0), 0);
      const summaryRows: (string | number)[][] = [
        ["Metric", "Value"],
        ["Total Revenue", Number(totalRevenue.toFixed(2))],
        ["Total Collected", Number(totalCollected.toFixed(2))],
        ["Total Outstanding", Number(totalOutstanding.toFixed(2))],
        ["Total Expenses", Number(totalExpenses.toFixed(2))],
        ["Net Income (Revenue - Expenses)", Number((totalRevenue - totalExpenses).toFixed(2))],
        ["Total Invoices", invoices.length],
        ["Total Quotations", quotations.length],
        ["Total Expenses Records", expenses.length],
        ["Total Customers", customers.length],
        ["Export Date", new Date().toLocaleDateString("en-GB")],
        from ? ["From", from] : ["From", "All time"],
        to ? ["To", to] : ["To", "All time"],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 36 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const rangeStr = from && to ? `_${from}_to_${to}` : "";
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="quotesphere-export${rangeStr}.xlsx"`,
        },
      });
    }

    // format=json — for client statement / financial report data
    if (format === "json") {
      const invoiceQ: Record<string, unknown> = {};
      const expenseQ: Record<string, unknown> = {};
      if (dateQ) { invoiceQ.issue_date = dateQ; expenseQ.bill_date = dateQ; }
      if (customerId) { invoiceQ.customer_id = customerId; expenseQ.customer_id = customerId; }

      const [invoices, expenses] = await Promise.all([
        Invoice.find(invoiceQ).sort({ issue_date: -1 }).limit(10000).lean(),
        Expense.find(expenseQ).sort({ bill_date: -1 }).limit(10000).lean(),
      ]);

      const quotationQ: Record<string, unknown> = {};
      if (dateQ) quotationQ.issue_date = dateQ;
      if (customerId) quotationQ.customer_id = customerId;
      const quotations = await Quotation.find(quotationQ).sort({ issue_date: -1 }).limit(10000).lean();

      let customer = null;
      if (customerId) {
        customer = await Customer.findById(customerId).lean();
      }

      return NextResponse.json({ success: true, data: { invoices, quotations, expenses, customer } });
    }

    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  } catch (err) {
    console.error("[export]", err);
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
