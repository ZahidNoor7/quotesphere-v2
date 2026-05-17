"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T1, T2, T3, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD, TABLE_STYLE, TH_STYLE, TD_STYLE, TABLE_WRAP } from "@/lib/ds";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

type AgingBucket = {
  label: string;
  invoiceCount: number;
  totalOutstanding: number;
  invoices: {
    invoice_no: string;
    customer_name: string;
    due_date: string;
    outstanding: number;
    total_amount: number;
    currency: string;
    daysOverdue: number;
  }[];
};

const BUCKET_COLORS = ["#34d399", "#fbbf24", "#fb923c", "#f87171", "#dc2626"];

export default function AgingPage() {
  const { settings } = useSettings();
  const currency = settings?.default_currency ?? "PKR";
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading, mutate } = useSWR<{ buckets: AgingBucket[]; summary: { totalOutstanding: number; totalInvoices: number } }>(
    "/api/reports/aging",
    fetcher,
    { revalidateOnFocus: false }
  );

  const buckets = data?.buckets ?? [];
  const summary = data?.summary;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <Link href="/reports" style={{ display: "flex", alignItems: "center", gap: 6, color: T2, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={14} /> Reports
        </Link>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginLeft: 12 }}>Aging Receivables</div>
        <div style={{ marginLeft: "auto" }}>
          <Button variant="ghost" size="sm" onClick={() => mutate()}>
            <RefreshCw size={13} style={{ marginRight: 4 }} /> Refresh
          </Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflowY: "auto" }}>
        {/* Summary cards */}
        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
            <div className="kpi-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T3, marginBottom: 4 }}>TOTAL OUTSTANDING</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#f87171" }}>
                {formatCurrency(summary.totalOutstanding, currency)}
              </div>
            </div>
            <div className="kpi-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T3, marginBottom: 4 }}>UNPAID INVOICES</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: T1 }}>{summary.totalInvoices}</div>
            </div>
          </div>
        )}

        {isLoading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Bucket cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {buckets.map((bucket, idx) => {
            const color = BUCKET_COLORS[idx] ?? "#6366f1";
            const isExpanded = expanded === idx;
            return (
              <div key={bucket.label} style={{ ...CARD, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Bucket header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : idx)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{bucket.label}</div>
                    <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{bucket.invoiceCount} invoice{bucket.invoiceCount !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color }}>{formatCurrency(bucket.totalOutstanding, currency)}</div>
                    <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>outstanding</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: T3, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    <path d="M3 6l5 5 5-5" />
                  </svg>
                </button>

                {/* Invoice list */}
                {isExpanded && bucket.invoices.length > 0 && (
                  <div style={{ borderTop: `0.5px solid ${GLASS_BORDER}` }}>
                    <div style={TABLE_WRAP}>
                      <table style={TABLE_STYLE}>
                        <thead>
                          <tr>
                            {["Invoice #", "Customer", "Due Date", "Days Overdue", "Outstanding"].map(h => (
                              <th key={h} style={TH_STYLE}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bucket.invoices.map(inv => (
                            <tr key={inv.invoice_no} className="table-row-hover">
                              <td style={TD_STYLE}>
                                <Link href={`/invoices?search=${inv.invoice_no}`} style={{ color: "#818cf8", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>
                                  {inv.invoice_no}
                                </Link>
                              </td>
                              <td style={{ ...TD_STYLE, color: T2 }}>{inv.customer_name}</td>
                              <td style={{ ...TD_STYLE, color: T2 }}>{formatDate(inv.due_date)}</td>
                              <td style={{ ...TD_STYLE }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                                  background: inv.daysOverdue > 0 ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
                                  color: inv.daysOverdue > 0 ? "#f87171" : "#34d399",
                                }}>
                                  {inv.daysOverdue > 0 ? `${inv.daysOverdue}d overdue` : "Current"}
                                </span>
                              </td>
                              <td style={{ ...TD_STYLE, color: "#f87171", fontWeight: 600 }}>
                                {formatCurrency(inv.outstanding, inv.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {isExpanded && bucket.invoices.length === 0 && (
                  <div style={{ padding: "20px 18px", color: T3, fontSize: 13, textAlign: "center", borderTop: `0.5px solid ${GLASS_BORDER}` }}>
                    No invoices in this bucket
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
