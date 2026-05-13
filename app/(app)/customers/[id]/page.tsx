"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { PaymentStatusBadge, QuotationStatusBadge, ExpenseStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD } from "@/lib/ds";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/hooks/use-settings";
import type { Customer, Invoice, Quotation, Expense } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

type Tab = "invoices" | "quotations" | "expenses";
const AV_COLORS = ["#818cf8","#2dd4bf","#fbbf24","#c4b5fd","#34d399","#f87171"];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("invoices");
  const [stmtLoading, setStmtLoading] = useState(false);
  const { data, isLoading } = useSWR(`/api/customers/${id}`, fetcher);
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!data) return <div style={{ padding: 24, color: T3 }}>Client not found.</div>;

  const { customer, invoices, quotations, expenses, stats } = data as {
    customer: Customer; invoices: Invoice[]; quotations: Quotation[]; expenses: Expense[];
    stats: { totalInvoiced: number; totalPaid: number; totalOutstanding: number; totalExpenses: number; invoiceCount: number; quotationCount: number; };
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "invoices", label: "Invoices", count: invoices.length },
    { key: "quotations", label: "Quotations", count: quotations.length },
    { key: "expenses", label: "Expenses", count: expenses.length },
  ];

  const avColor = AV_COLORS[customer.name.charCodeAt(0) % AV_COLORS.length];

  async function downloadStatement() {
    setStmtLoading(true);
    try {
      const res = await fetch(`/api/export?format=json&customer_id=${id}`).then(r => r.json());
      if (!res.success) throw new Error(res.error ?? "Fetch failed");
      const { downloadClientStatement } = await import("@/lib/report-pdf");
      await downloadClientStatement({
        customer: res.data.customer,
        invoices: res.data.invoices ?? [],
        quotations: res.data.quotations ?? [],
        expenses: res.data.expenses ?? [],
        settings: settings ?? null,
        currency: settings?.default_currency ?? "PKR",
      });
      toast.success("Client statement generated.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate statement.");
    } finally {
      setStmtLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`.cust-detail-row:hover td { background: rgba(255,255,255,0.03); }`}</style>
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link href="/customers" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, textDecoration: "none", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4"/></svg>
            Clients
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {!isMobile && (
            <Button variant="outline" size="sm" onClick={downloadStatement} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <FileText size={12} />{stmtLoading ? "Generating…" : "Statement PDF"}
            </Button>
          )}
          <Button asChild variant="outline" size="sm"><Link href={`/quotations/new?customer_id=${id}`}>{isMobile ? "+ Quote" : "+ Quotation"}</Link></Button>
          <Button asChild size="sm"><Link href={`/invoices/new?customer_id=${id}`}>{isMobile ? "+ Invoice" : "+ Invoice"}</Link></Button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: isMobile ? "auto" : "hidden", overflowY: "auto", padding: isMobile ? "14px 12px" : "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Top: profile + stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {/* Profile card */}
          <div style={{ ...CARD, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${avColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, color: avColor, border: `0.5px solid ${avColor}50`, boxShadow: `0 0 0 3px ${avColor}18`, flexShrink: 0 }}>
                {getInitials(customer.name)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>{customer.name}</div>
                <div style={{ fontSize: 11, color: T3 }}>{customer.company ? `${customer.company} · ` : ""}Since {formatDate(customer.createdAt)}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Phone", val: customer.phone_no },
                ...(customer.email ? [{ label: "Email", val: customer.email }] : []),
                ...(customer.address ? [{ label: "Address", val: customer.address }] : []),
                ...(customer.tax_id ? [{ label: "NTN", val: customer.tax_id }] : []),
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: T3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: T1, marginTop: 1 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats card */}
          <div style={{ ...CARD, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 10 }}>Client stats</div>
            {[
              { dot: "#34d399", val: formatCurrency(stats?.totalInvoiced ?? 0), lbl: "Total invoiced" },
              { dot: "#34d399", val: formatCurrency(stats?.totalPaid ?? 0), lbl: `${Math.round(stats?.totalInvoiced > 0 ? (stats.totalPaid / stats.totalInvoiced) * 100 : 0)}% collected` },
              { dot: "#fbbf24", val: formatCurrency(stats?.totalOutstanding ?? 0), lbl: "Pending balance" },
              { dot: "#60a5fa", val: `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`, lbl: `${quotations.length} quotation${quotations.length !== 1 ? "s" : ""}` },
            ].map(({ dot, val, lbl }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: GLASS, borderRadius: 8, marginBottom: 5, border: `0.5px solid ${GLASS_BORDER}` }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: dot, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>{val}</div>
                  <div style={{ fontSize: 11, color: T3 }}>{lbl}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", gap: 2, padding: 4, background: GLASS, borderRadius: 100, width: "fit-content" }}>
          {tabs.map(({ key, label, count }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: "6px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer", border: "none", outline: "none", transition: "all 0.2s",
                ...(tab === key
                  ? { background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(129,140,248,0.18))", color: AC2, fontWeight: 500, boxShadow: "0 1px 6px rgba(99,102,241,0.2)" }
                  : { background: "none", color: T3 }),
              }}
            >{label} <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span></button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ borderRadius: 12, border: `0.5px solid ${GLASS_BORDER}`, overflow: isMobile ? "visible" : "hidden" }}>
          {/* Invoices */}
          {tab === "invoices" && (
            invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 13, color: T2, marginBottom: 6 }}>No invoices yet</div>
                <Button asChild size="sm"><Link href={`/invoices/new?customer_id=${id}`}>+ Create invoice</Link></Button>
              </div>
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {invoices.map((inv: Invoice, i) => (
                  <div key={inv._id} style={{ padding: "12px 14px", borderTop: i > 0 ? `0.5px solid rgba(255,255,255,0.05)` : "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: AC2, fontWeight: 600, fontSize: 13, flex: 1 }}>{inv.invoice_no}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{formatCurrency(inv.total_amount, inv.currency)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <PaymentStatusBadge status={inv.payment_status} />
                      {inv.outstanding > 0 && (
                        <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 500 }}>
                          {formatCurrency(inv.outstanding, inv.currency)} outstanding
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: T3, marginLeft: "auto" }}>{formatDate(inv.issue_date)}</span>
                    </div>
                    <Link href={`/invoices/${inv._id}`} style={{ fontSize: 11.5, color: AC2, textDecoration: "none", alignSelf: "flex-end" }}>View →</Link>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["Invoice","Date","Amount","Outstanding","Status",""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: Invoice) => (
                    <tr key={inv._id}
                      className="cust-detail-row"
                    >
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: AC2, fontWeight: 500 }}>{inv.invoice_no}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{formatDate(inv.issue_date)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 600 }}>{formatCurrency(inv.total_amount, inv.currency)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: inv.outstanding > 0 ? "#fbbf24" : "#34d399", fontWeight: 500 }}>
                        {inv.outstanding > 0 ? formatCurrency(inv.outstanding, inv.currency) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><PaymentStatusBadge status={inv.payment_status} /></td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                        <Link href={`/invoices/${inv._id}`} style={{ fontSize: 11.5, color: AC2, textDecoration: "none" }}>View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Quotations */}
          {tab === "quotations" && (
            quotations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 13, color: T2, marginBottom: 6 }}>No quotations yet</div>
                <Button asChild size="sm"><Link href={`/quotations/new?customer_id=${id}`}>+ Create quotation</Link></Button>
              </div>
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {quotations.map((qt: Quotation, i) => (
                  <div key={qt._id} style={{ padding: "12px 14px", borderTop: i > 0 ? `0.5px solid rgba(255,255,255,0.05)` : "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: AC2, fontWeight: 600, fontSize: 13, flex: 1 }}>{qt.quotation_no}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{formatCurrency(qt.total_amount, qt.currency)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <QuotationStatusBadge status={qt.status} />
                      <span style={{ fontSize: 11, color: T3 }}>{formatDate(qt.issue_date)}</span>
                      {qt.valid_until && (
                        <span style={{ fontSize: 11, color: T3, marginLeft: "auto" }}>Until {formatDate(qt.valid_until)}</span>
                      )}
                    </div>
                    <Link href={`/quotations/${qt._id}`} style={{ fontSize: 11.5, color: AC2, textDecoration: "none", alignSelf: "flex-end" }}>View →</Link>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["Quotation","Date","Valid until","Amount","Status",""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((qt: Quotation) => (
                    <tr key={qt._id}>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: AC2, fontWeight: 500 }}>{qt.quotation_no}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{formatDate(qt.issue_date)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{qt.valid_until ? formatDate(qt.valid_until) : "—"}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 600 }}>{formatCurrency(qt.total_amount, qt.currency)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><QuotationStatusBadge status={qt.status} /></td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                        <Link href={`/quotations/${qt._id}`} style={{ fontSize: 11.5, color: AC2, textDecoration: "none" }}>View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Expenses */}
          {tab === "expenses" && (
            expenses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 13, color: T2, marginBottom: 6 }}>No expenses recorded</div>
                <Button asChild size="sm"><Link href={`/expenses/new?customer_id=${id}`}>+ Record expense</Link></Button>
              </div>
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {expenses.map((exp: Expense, i) => (
                  <div key={exp._id} style={{ padding: "12px 14px", borderTop: i > 0 ? `0.5px solid rgba(255,255,255,0.05)` : "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: AC2, fontWeight: 600, fontSize: 13, flex: 1 }}>{exp.expense_no}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{formatCurrency(exp.total_amount, exp.currency)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <ExpenseStatusBadge status={exp.status} />
                      {exp.vendor_name && <span style={{ fontSize: 11, color: T2 }}>{exp.vendor_name}</span>}
                      <span style={{ fontSize: 11, color: T3, marginLeft: "auto" }}>{formatDate(exp.bill_date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["Expense","Date","Vendor","Amount","Status"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp: Expense) => (
                    <tr key={exp._id}>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: AC2, fontWeight: 500 }}>{exp.expense_no}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{formatDate(exp.bill_date)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2 }}>{exp.vendor_name || "—"}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 600 }}>{formatCurrency(exp.total_amount, exp.currency)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><ExpenseStatusBadge status={exp.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
