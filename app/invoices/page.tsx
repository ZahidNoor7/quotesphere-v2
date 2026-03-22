"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge, InvoiceStatusBadge } from "@/components/shared/status-badges";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TABLE_WRAP, TOPBAR_STYLE, GLASS_INPUT, GLASS_SELECT, ICON_PILL } from "@/lib/ds";
import type { Invoice } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (payStatus) params.set("payment_status", payStatus);

  const { data, mutate, isLoading } = useSWR(`/api/invoices?${params}`, fetcher, { keepPreviousData: true });
  const invoices: Invoice[] = data?.data ?? [];
  const pagination = data?.pagination;

  async function del(id: string) {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    toast.success("Invoice deleted.");
    mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>Invoices</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button asChild size="sm"><Link href="/invoices/new">+ New Invoice</Link></Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by # or client..." style={{ ...GLASS_INPUT, flex: 1, minWidth: 140 }} />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={GLASS_SELECT}>
            <option value="">All status</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={payStatus} onChange={e => { setPayStatus(e.target.value); setPage(1); }} style={GLASS_SELECT}>
            <option value="">All payment</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="complete">Paid</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ ...TABLE_WRAP, flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 8 }}>
              <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke={T3} strokeWidth="0.8"><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v3h3M5 7h6M5 10h4"/></svg>
              <div style={{ fontSize: 13, color: T2, fontWeight: 500 }}>No invoices found</div>
              <div style={{ fontSize: 12, color: T3 }}>Create your first invoice to get started</div>
              <Button asChild size="sm" style={{ marginTop: 8 }}><Link href="/invoices/new">+ Create invoice</Link></Button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: 28, background: "rgba(255,255,255,0.04)", padding: "9px 12px" }}><input type="checkbox" style={{ accentColor: "#6366f1" }} /></th>
                  <th style={{ width: 95, background: "rgba(255,255,255,0.04)", padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Invoice #</th>
                  <th style={{ background: "rgba(255,255,255,0.04)", padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Client</th>
                  <th style={{ width: 110, background: "rgba(255,255,255,0.04)", padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Amount</th>
                  <th style={{ width: 85, background: "rgba(255,255,255,0.04)", padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Status</th>
                  <th style={{ width: 85, background: "rgba(255,255,255,0.04)", padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Payment</th>
                  <th style={{ width: 65, background: "rgba(255,255,255,0.04)", padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>Date</th>
                  <th style={{ width: 90, background: "rgba(255,255,255,0.04)", padding: "9px 12px" }} />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv._id} style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = "rgba(255,255,255,0.03)"))}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = ""))}
                  >
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><input type="checkbox" style={{ accentColor: "#6366f1" }} /></td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: AC2, fontWeight: 500 }}>
                      <Link href={`/invoices/${inv._id}`} style={{ color: "inherit", textDecoration: "none" }}>{inv.invoice_no}</Link>
                    </td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customer_name}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500 }}>{formatCurrency(inv.total_amount, inv.currency)}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><InvoiceStatusBadge status={inv.status} /></td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><PaymentStatusBadge status={inv.payment_status} /></td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{formatDate(inv.issue_date)}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/invoices/${inv._id}`} style={{ ...ICON_PILL, textDecoration: "none", fontSize: 13 }} title="View">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M1.5 8C3 4 5 2 8 2s5 2 6.5 6c-1.5 4-3.5 6-6.5 6s-5-2-6.5-6z"/></svg>
                        </Link>
                        <Link href={`/invoices/${inv._id}/edit`} style={{ ...ICON_PILL, textDecoration: "none", fontSize: 13 }} title="Edit">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2L5 13l-3 1 1-3z"/></svg>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button style={{ ...ICON_PILL, background: "none", border: "0.5px solid rgba(255,255,255,0.11)" }} title="Delete"
                              onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" })}
                              onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: "none", color: T2, borderColor: GLASS_BORDER })}
                            >
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete {inv.invoice_no}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. All payment records will also be deleted.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(inv._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T3 }}>
              {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
