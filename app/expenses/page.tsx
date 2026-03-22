"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExpenseStatusBadge } from "@/components/shared/status-badges";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TABLE_WRAP, TOPBAR_STYLE, GLASS_INPUT, GLASS_SELECT, ICON_PILL } from "@/lib/ds";
import type { Expense } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const { data, mutate, isLoading } = useSWR(`/api/expenses?${params}`, fetcher, { keepPreviousData: true });
  const expenses: Expense[] = data?.data ?? [];
  const pagination = data?.pagination;
  const pageTotal = expenses.reduce((s, e) => s + e.total_amount, 0);

  async function del(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    toast.success("Deleted."); mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Expenses</div>
        <div style={{ marginLeft: "auto" }}>
          <Button asChild size="sm"><Link href="/expenses/new">+ Add expense</Link></Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search expenses, vendors..." style={{ ...GLASS_INPUT, flex: 1, minWidth: 140 }} />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={GLASS_SELECT}>
            <option value="">All status</option>
            <option value="recorded">Recorded</option>
            <option value="verified">Verified</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div style={{ ...TABLE_WRAP, flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 13, color: T2, marginBottom: 6 }}>No expenses recorded</div>
              <Button asChild size="sm"><Link href="/expenses/new">+ Record expense</Link></Button>
            </div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["Expense #", "Date", "Vendor", "Client", "Amount", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase", width: h === "" ? 50 : h === "Status" ? 80 : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp._id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = "rgba(255,255,255,0.03)"))}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = ""))}
                    >
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: AC2, fontWeight: 500 }}>{exp.expense_no}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T3 }}>{formatDate(exp.bill_date)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.vendor_name || "—"}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.customer_name}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T1, fontWeight: 500 }}>{formatCurrency(exp.total_amount, exp.currency)}</td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}><ExpenseStatusBadge status={exp.status} /></td>
                      <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button style={ICON_PILL}
                              onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" })}
                              onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: GLASS, color: T2, borderColor: GLASS_BORDER })}
                            >
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete {exp.expense_no}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(exp._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "rgba(255,255,255,0.025)" }}>
                    <td colSpan={4} style={{ padding: "8px 12px", fontSize: 11, color: T3, fontWeight: 500 }}>Page total</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: T1 }}>{formatCurrency(pageTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>

        {pagination && pagination.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T3 }}>{(page-1)*pagination.limit+1}–{Math.min(page*pagination.limit,pagination.total)} of {pagination.total}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page>=pagination.pages} onClick={()=>setPage(p=>p+1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
