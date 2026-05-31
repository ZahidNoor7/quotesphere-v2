"use client";
/**
 * PDF templates for Financial Reports and Client Statements.
 * Uses @react-pdf/renderer (vector). Invoice/quotation PDFs use headless Chrome
 * via /api/pdf instead — see lib/pdf/browser.ts.
 */
import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Invoice, Quotation, Expense, Customer, Settings } from "@/types";

const ACCENT = "#6366f1";
const DARK = "#0f172a";
const MID = "#475569";
const LIGHT = "#94a3b8";
const ROW_ALT = "#f8fafc";
const BORDER = "#e2e8f0";

function fmt(n: number, currency = "PKR") {
  return `${currency} ${Number(n ?? 0).toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d: Date | string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function cap(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : ""; }

const base = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: DARK, padding: "36 40 36 40", backgroundColor: "#ffffff" },
  header: { marginBottom: 20 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: ACCENT, marginBottom: 2 },
  reportTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 4 },
  subtitle: { fontSize: 9, color: LIGHT },
  divider: { borderBottom: `1.5 solid ${ACCENT}`, marginBottom: 14, marginTop: 10 },
  thinDivider: { borderBottom: `0.5 solid ${BORDER}`, marginBottom: 10, marginTop: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 8 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, padding: "10 12", backgroundColor: "#f1f5f9", borderRadius: 4 },
  summaryLabel: { fontSize: 8, color: LIGHT, marginBottom: 3, textTransform: "uppercase" as const },
  summaryValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK },
  summaryValueAccent: { fontSize: 14, fontFamily: "Helvetica-Bold", color: ACCENT },
  summaryValueRed: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#ef4444" },
  // Table
  tableHeader: { flexDirection: "row", backgroundColor: DARK, padding: "5 6", marginBottom: 1 },
  tableHeaderText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  tableRow: { flexDirection: "row", padding: "4 6", borderBottom: `0.5 solid ${BORDER}` },
  tableRowAlt: { flexDirection: "row", padding: "4 6", backgroundColor: ROW_ALT, borderBottom: `0.5 solid ${BORDER}` },
  tableCell: { fontSize: 8, color: DARK },
  tableCellMid: { fontSize: 8, color: MID },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTop: `0.5 solid ${BORDER}`, paddingTop: 6 },
  footerText: { fontSize: 7.5, color: LIGHT },
  badge: { padding: "2 5", borderRadius: 3, alignSelf: "flex-start" },
  pill: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
});

// ─── Status badge color ────────────────────────────────────────────────────────
function statusColor(s: string): string {
  const map: Record<string, string> = {
    complete: "#059669", paid: "#059669", approved: "#059669",
    partial: "#d97706", pending: "#d97706",
    draft: "#64748b", issued: "#3b82f6", cancelled: "#ef4444", rejected: "#ef4444",
  };
  return map[s] ?? "#64748b";
}

// ─── Page header reused in both templates ─────────────────────────────────────
function ReportHeader({ title, subtitle, settings, dateRange }: {
  title: string; subtitle: string;
  settings: Partial<Settings> | null;
  dateRange?: { from?: string; to?: string };
}) {
  const company = settings?.company_name ?? "Your Company";
  const rangeText = dateRange?.from || dateRange?.to
    ? `Period: ${dateRange.from ? fmtDate(dateRange.from) : "All time"} — ${dateRange.to ? fmtDate(dateRange.to) : "All time"}`
    : "All time";
  return (
    <View style={base.header}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={base.companyName}>{company}</Text>
          <Text style={base.reportTitle}>{title}</Text>
          <Text style={base.subtitle}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 8, color: LIGHT }}>Generated {fmtDate(new Date())}</Text>
          <Text style={{ fontSize: 8, color: LIGHT, marginTop: 2 }}>{rangeText}</Text>
          {settings?.company_email && <Text style={{ fontSize: 8, color: LIGHT, marginTop: 2 }}>{settings.company_email}</Text>}
        </View>
      </View>
      <View style={base.divider} />
    </View>
  );
}

// ─── Financial Report ─────────────────────────────────────────────────────────
export interface FinancialReportData {
  invoices: Invoice[];
  expenses: Expense[];
  settings: Partial<Settings> | null;
  from?: string;
  to?: string;
  currency: string;
}

export function FinancialReportPdf({ invoices, expenses, settings, from, to, currency }: FinancialReportData) {
  const totalRevenue = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + (i.total_paid ?? 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + (i.outstanding ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.total_amount ?? 0), 0);
  const netIncome = totalRevenue - totalExpenses;

  const invoicesPaid    = invoices.filter(i => i.payment_status === "complete").length;
  const invoicesPending = invoices.filter(i => i.payment_status === "pending").length;
  const invoicesPartial = invoices.filter(i => i.payment_status === "partial").length;

  return (
    <Document>
      <Page size="A4" style={base.page}>
        <ReportHeader
          title="Financial Report"
          subtitle="Revenue, collections, and expense summary"
          settings={settings}
          dateRange={{ from, to }}
        />

        {/* Summary cards */}
        <View style={base.summaryRow}>
          {[
            { label: "Total Revenue", value: fmt(totalRevenue, currency), style: "summaryValueAccent" as const },
            { label: "Collected", value: fmt(totalCollected, currency), style: "summaryValue" as const },
            { label: "Outstanding", value: fmt(totalOutstanding, currency), style: "summaryValueRed" as const },
            { label: "Total Expenses", value: fmt(totalExpenses, currency), style: "summaryValueRed" as const },
            { label: "Net Income", value: fmt(netIncome, currency), style: netIncome >= 0 ? "summaryValue" as const : "summaryValueRed" as const },
          ].map(({ label, value, style }) => (
            <View key={label} style={base.summaryCard}>
              <Text style={base.summaryLabel}>{label}</Text>
              <Text style={base[style]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Invoice breakdown row */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
          {[
            { label: "Total Invoices", value: invoices.length },
            { label: "Paid", value: invoicesPaid },
            { label: "Partial", value: invoicesPartial },
            { label: "Pending", value: invoicesPending },
            { label: "Total Expenses", value: expenses.length },
          ].map(({ label, value }) => (
            <View key={label} style={{ flex: 1, padding: "6 10", backgroundColor: "#f8fafc", borderRadius: 4, border: `0.5 solid ${BORDER}` }}>
              <Text style={{ fontSize: 7, color: LIGHT, marginBottom: 2 }}>{label.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK }}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Invoices table */}
        <Text style={base.sectionTitle}>Invoices ({invoices.length})</Text>
        <View style={base.tableHeader}>
          {[["Invoice #", 70], ["Date", 55], ["Client", 120], ["Total", 65], ["Paid", 65], ["Outstanding", 70], ["Status", 55]].map(([h, w]) => (
            <Text key={h} style={[base.tableHeaderText, { width: w as number }]}>{h}</Text>
          ))}
        </View>
        {invoices.slice(0, 200).map((inv, idx) => (
          <View key={inv._id} style={idx % 2 === 0 ? base.tableRow : base.tableRowAlt}>
            <Text style={[base.tableCell, { width: 70, color: ACCENT }]}>{inv.invoice_no}</Text>
            <Text style={[base.tableCellMid, { width: 55 }]}>{fmtDate(inv.issue_date)}</Text>
            <Text style={[base.tableCell, { width: 120 }]}>{inv.customer_name}</Text>
            <Text style={[base.tableCell, { width: 65, textAlign: "right" }]}>{fmt(inv.total_amount, inv.currency)}</Text>
            <Text style={[base.tableCell, { width: 65, textAlign: "right", color: "#059669" }]}>{fmt(inv.total_paid, inv.currency)}</Text>
            <Text style={[base.tableCell, { width: 70, textAlign: "right", color: inv.outstanding > 0 ? "#ef4444" : DARK }]}>{fmt(inv.outstanding, inv.currency)}</Text>
            <Text style={[base.pill, { width: 55, color: statusColor(inv.payment_status) }]}>{cap(inv.payment_status)}</Text>
          </View>
        ))}
        {invoices.length > 200 && <Text style={{ fontSize: 7.5, color: LIGHT, marginTop: 4 }}>… and {invoices.length - 200} more invoices</Text>}

        <View style={base.thinDivider} />

        {/* Expenses table */}
        <Text style={[base.sectionTitle, { marginTop: 6 }]}>Expenses ({expenses.length})</Text>
        <View style={base.tableHeader}>
          {[["Expense #", 70], ["Date", 55], ["Vendor", 110], ["Client", 100], ["Total", 65], ["Status", 65]].map(([h, w]) => (
            <Text key={h} style={[base.tableHeaderText, { width: w as number }]}>{h}</Text>
          ))}
        </View>
        {expenses.slice(0, 150).map((exp, idx) => (
          <View key={exp._id} style={idx % 2 === 0 ? base.tableRow : base.tableRowAlt}>
            <Text style={[base.tableCell, { width: 70, color: ACCENT }]}>{exp.expense_no}</Text>
            <Text style={[base.tableCellMid, { width: 55 }]}>{fmtDate(exp.bill_date)}</Text>
            <Text style={[base.tableCell, { width: 110 }]}>{exp.vendor_name ?? "—"}</Text>
            <Text style={[base.tableCellMid, { width: 100 }]}>{exp.customer_name}</Text>
            <Text style={[base.tableCell, { width: 65, textAlign: "right", color: "#ef4444" }]}>{fmt(exp.total_amount, exp.currency)}</Text>
            <Text style={[base.pill, { width: 65, color: statusColor(exp.payment_status) }]}>{cap(exp.payment_status)}</Text>
          </View>
        ))}
        {expenses.length > 150 && <Text style={{ fontSize: 7.5, color: LIGHT, marginTop: 4 }}>… and {expenses.length - 150} more expenses</Text>}

        <View style={base.footer}>
          <Text style={base.footerText}>{settings?.company_name} — Financial Report</Text>
          <Text style={base.footerText}>Confidential — Generated by QuoteSphere</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Client Statement ─────────────────────────────────────────────────────────
export interface ClientStatementData {
  customer: Customer;
  invoices: Invoice[];
  quotations: Quotation[];
  expenses: Expense[];
  settings: Partial<Settings> | null;
  from?: string;
  to?: string;
  currency: string;
}

export function ClientStatementPdf({ customer, invoices, quotations, expenses, settings, from, to, currency }: ClientStatementData) {
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const totalPaid     = invoices.reduce((s, i) => s + (i.total_paid ?? 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + (i.outstanding ?? 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.total_amount ?? 0), 0);

  return (
    <Document>
      <Page size="A4" style={base.page}>
        <ReportHeader
          title="Client Statement"
          subtitle={`Account statement for ${customer.name}`}
          settings={settings}
          dateRange={{ from, to }}
        />

        {/* Client info */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
          <View style={{ flex: 1, padding: "10 14", backgroundColor: "#f8fafc", borderRadius: 4, border: `1 solid ${BORDER}` }}>
            <Text style={{ fontSize: 8, color: LIGHT, marginBottom: 6, textTransform: "uppercase" as const }}>Bill To</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 }}>{customer.name}</Text>
            {customer.company && <Text style={{ fontSize: 8.5, color: MID, marginBottom: 2 }}>{customer.company}</Text>}
            {customer.phone_no && <Text style={{ fontSize: 8.5, color: MID, marginBottom: 2 }}>{customer.phone_no}</Text>}
            {customer.email && <Text style={{ fontSize: 8.5, color: MID, marginBottom: 2 }}>{customer.email}</Text>}
            {customer.address && <Text style={{ fontSize: 8.5, color: LIGHT }}>{customer.address}</Text>}
          </View>
          <View style={{ flex: 2, flexDirection: "row", gap: 8 }}>
            {[
              { label: "Total Invoiced", value: fmt(totalInvoiced, currency), color: DARK },
              { label: "Total Paid", value: fmt(totalPaid, currency), color: "#059669" },
              { label: "Outstanding", value: fmt(totalOutstanding, currency), color: totalOutstanding > 0 ? "#ef4444" : "#059669" },
              { label: "Expenses", value: fmt(totalExpenses, currency), color: "#f59e0b" },
            ].map(({ label, value, color }) => (
              <View key={label} style={[base.summaryCard, { flex: 1 }]}>
                <Text style={base.summaryLabel}>{label}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Invoices */}
        <Text style={base.sectionTitle}>Invoices ({invoices.length})</Text>
        <View style={base.tableHeader}>
          {[["Invoice #", 72], ["Date", 60], ["Due Date", 60], ["Total", 80], ["Paid", 75], ["Outstanding", 80], ["Status", 60]].map(([h, w]) => (
            <Text key={h} style={[base.tableHeaderText, { width: w as number }]}>{h}</Text>
          ))}
        </View>
        {invoices.map((inv, idx) => (
          <View key={inv._id} style={idx % 2 === 0 ? base.tableRow : base.tableRowAlt}>
            <Text style={[base.tableCell, { width: 72, color: ACCENT }]}>{inv.invoice_no}</Text>
            <Text style={[base.tableCellMid, { width: 60 }]}>{fmtDate(inv.issue_date)}</Text>
            <Text style={[base.tableCellMid, { width: 60 }]}>{fmtDate(inv.due_date)}</Text>
            <Text style={[base.tableCell, { width: 80, textAlign: "right" }]}>{fmt(inv.total_amount, inv.currency)}</Text>
            <Text style={[base.tableCell, { width: 75, textAlign: "right", color: "#059669" }]}>{fmt(inv.total_paid, inv.currency)}</Text>
            <Text style={[base.tableCell, { width: 80, textAlign: "right", color: inv.outstanding > 0 ? "#ef4444" : DARK }]}>{fmt(inv.outstanding, inv.currency)}</Text>
            <Text style={[base.pill, { width: 60, color: statusColor(inv.payment_status) }]}>{cap(inv.payment_status)}</Text>
          </View>
        ))}
        {invoices.length === 0 && <Text style={{ fontSize: 8, color: LIGHT, padding: "6 6" }}>No invoices in this period.</Text>}

        <View style={base.thinDivider} />

        {/* Quotations */}
        <Text style={[base.sectionTitle, { marginTop: 4 }]}>Quotations ({quotations.length})</Text>
        <View style={base.tableHeader}>
          {[["Quotation #", 80], ["Date", 60], ["Valid Until", 65], ["Total", 90], ["Status", 70]].map(([h, w]) => (
            <Text key={h} style={[base.tableHeaderText, { width: w as number }]}>{h}</Text>
          ))}
        </View>
        {quotations.map((qt, idx) => (
          <View key={qt._id} style={idx % 2 === 0 ? base.tableRow : base.tableRowAlt}>
            <Text style={[base.tableCell, { width: 80, color: ACCENT }]}>{qt.quotation_no}</Text>
            <Text style={[base.tableCellMid, { width: 60 }]}>{fmtDate(qt.issue_date)}</Text>
            <Text style={[base.tableCellMid, { width: 65 }]}>{fmtDate(qt.valid_until)}</Text>
            <Text style={[base.tableCell, { width: 90, textAlign: "right" }]}>{fmt(qt.total_amount, qt.currency)}</Text>
            <Text style={[base.pill, { width: 70, color: statusColor(qt.status) }]}>{cap(qt.status)}</Text>
          </View>
        ))}
        {quotations.length === 0 && <Text style={{ fontSize: 8, color: LIGHT, padding: "6 6" }}>No quotations in this period.</Text>}

        {expenses.length > 0 && (
          <>
            <View style={base.thinDivider} />
            <Text style={[base.sectionTitle, { marginTop: 4 }]}>Expenses ({expenses.length})</Text>
            <View style={base.tableHeader}>
              {[["Expense #", 80], ["Date", 60], ["Vendor", 130], ["Total", 90], ["Status", 70]].map(([h, w]) => (
                <Text key={h} style={[base.tableHeaderText, { width: w as number }]}>{h}</Text>
              ))}
            </View>
            {expenses.map((exp, idx) => (
              <View key={exp._id} style={idx % 2 === 0 ? base.tableRow : base.tableRowAlt}>
                <Text style={[base.tableCell, { width: 80, color: ACCENT }]}>{exp.expense_no}</Text>
                <Text style={[base.tableCellMid, { width: 60 }]}>{fmtDate(exp.bill_date)}</Text>
                <Text style={[base.tableCellMid, { width: 130 }]}>{exp.vendor_name ?? "—"}</Text>
                <Text style={[base.tableCell, { width: 90, textAlign: "right", color: "#f59e0b" }]}>{fmt(exp.total_amount, exp.currency)}</Text>
                <Text style={[base.pill, { width: 70, color: statusColor(exp.payment_status) }]}>{cap(exp.payment_status)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={base.footer}>
          <Text style={base.footerText}>{settings?.company_name} — Client Statement for {customer.name}</Text>
          <Text style={base.footerText}>Confidential — Generated by QuoteSphere</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Download helpers ─────────────────────────────────────────────────────────
export async function downloadFinancialReport(data: FinancialReportData, filename = "financial-report.pdf") {
  const blob = await pdf(<FinancialReportPdf {...data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadClientStatement(data: ClientStatementData, filename?: string) {
  const blob = await pdf(<ClientStatementPdf {...data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `statement-${data.customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
