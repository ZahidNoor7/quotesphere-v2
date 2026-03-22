"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuotationStatusBadge } from "@/components/shared/status-badges";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TABLE_WRAP, TOPBAR_STYLE, GLASS_INPUT, GLASS_SELECT, ICON_PILL } from "@/lib/ds";
import type { Quotation } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const { data, mutate, isLoading } = useSWR(`/api/quotations?${params}`, fetcher, { keepPreviousData: true });
  const quotations: Quotation[] = data?.data ?? [];
  const pagination = data?.pagination;

  async function del(id: string) {
    await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    toast.success("Quotation deleted."); mutate();
  }
  async function approve(id: string) {
    await fetch(`/api/quotations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved", approved_at: new Date() }) });
    toast.success("Approved."); mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Quotations</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button asChild size="sm"><Link href="/quotations/new">+ New quotation</Link></Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search quotations or clients..." style={{ ...GLASS_INPUT, flex: 1, minWidth: 140 }} />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={GLASS_SELECT}>
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="invoiced">Invoiced</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div style={{ ...TABLE_WRAP, flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : quotations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T3 }}>
              <div style={{ fontSize: 13, color: T2, marginBottom: 6 }}>No quotations found</div>
              <Button asChild size="sm"><Link href="/quotations/new">+ Create quotation</Link></Button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  {["Quote #", "Client", "Amount", "Valid until", "Status", "Actions"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase", width: i === 0 ? 100 : i === 5 ? 100 : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotations.map(qt => (
                  <tr key={qt._id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = "rgba(255,255,255,0.03)"))}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = ""))}
                  >
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: AC2, fontWeight: 500 }}>
                      <Link href={`/quotations/${qt._id}`} style={{ color: "inherit", textDecoration: "none" }}>{qt.quotation_no}</Link>
                    </td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{qt.customer_name}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500 }}>{formatCurrency(qt.total_amount, qt.currency)}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{qt.valid_until ? formatDate(qt.valid_until) : "—"}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><QuotationStatusBadge status={qt.status} /></td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {qt.status === "pending" && (
                          <button style={{ ...ICON_PILL, fontSize: 10, color: "#34d399" }} onClick={() => approve(qt._id)} title="Approve">✓</button>
                        )}
                        {qt.status === "approved" && !qt.converted_to && (
                          <Link href={`/quotations/${qt._id}`} style={{ ...ICON_PILL, textDecoration: "none", fontSize: 10, color: "#818cf8" }} title="Convert">→</Link>
                        )}
                        <Link href={`/quotations/${qt._id}`} style={{ ...ICON_PILL, textDecoration: "none" }} title="View">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M1.5 8C3 4 5 2 8 2s5 2 6.5 6c-1.5 4-3.5 6-6.5 6s-5-2-6.5-6z"/></svg>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button style={{ ...ICON_PILL }}
                              onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" })}
                              onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: GLASS, color: T2, borderColor: GLASS_BORDER })}
                            >
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete {qt.quotation_no}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(qt._id)}>Delete</AlertDialogAction></AlertDialogFooter>
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

        {pagination && pagination.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T3 }}>{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</span>
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
