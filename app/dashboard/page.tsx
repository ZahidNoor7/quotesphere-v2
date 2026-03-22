"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DashboardStats } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);
const T1 = "#eef0ff", T2 = "rgba(210,216,255,0.72)", T3 = "rgba(160,170,255,0.42)";
const PIE_COLORS = ["#fbbf24", "#a78bfa", "#34d399"];

const KPI_ICONS = {
  revenue: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#34d399" strokeWidth="1.5"><path d="M2 12l4-4 3 3 5-6"/></svg>,
  pending: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fbbf24" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v4l2.5 2.5"/></svg>,
  invoices: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" strokeWidth="1.5"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 7h6"/></svg>,
  clients: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a78bfa" strokeWidth="1.5"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5"/></svg>,
};

export default function DashboardPage() {
  const [tab, setTab] = useState<"overview" | "analytics">("overview");
  const { data: stats, isLoading } = useSWR<DashboardStats>("/api/dashboard", fetcher, { refreshInterval: 60000 });

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const s = stats!;

  return (
    <div className="animate-fade-in">
      {/* Topbar */}
      <div style={{
        display: "flex", alignItems: "center", padding: "12px 20px", gap: 12,
        backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)",
        background: "rgba(10,15,30,0.5)", borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>Dashboard</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <select style={{ background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 100, padding: "5px 10px", color: T2, fontSize: 11, outline: "none", cursor: "pointer" }}>
            <option>This month</option><option>Last 3 months</option><option>This year</option>
          </select>
          <Button asChild><Link href="/invoices/new">+ New invoice</Link></Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "18px 20px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, padding: 4, background: "rgba(255,255,255,0.055)", borderRadius: 100, width: "fit-content", marginBottom: 18 }}>
          {(["overview", "analytics"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 16px", borderRadius: 100, fontSize: 12, cursor: "pointer", border: "none", outline: "none",
                textTransform: "capitalize", transition: "all 0.2s", fontWeight: t === tab ? 500 : 400,
                ...(t === tab ? {
                  background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(129,140,248,0.18))",
                  color: "#818cf8", boxShadow: "0 1px 6px rgba(99,102,241,0.2)",
                } : { background: "none", color: T3 }),
              }}
            >{t}</button>
          ))}
        </div>

        {/* KPI grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
          {[
            { icon: KPI_ICONS.revenue, val: formatCurrency(s?.totalRevenue ?? 0), label: "Total revenue", change: `${s?.invoiceCount ?? 0} invoices`, up: true, color: "#34d399" },
            { icon: KPI_ICONS.pending, val: formatCurrency(s?.totalOutstanding ?? 0), label: "Pending payments", change: `${s?.overdueCount ?? 0} overdue`, up: false, color: "#fbbf24" },
            { icon: KPI_ICONS.invoices, val: String(s?.invoiceCount ?? 0), label: "Total invoices", change: formatCurrency(s?.totalReceived ?? 0) + " collected", up: true, color: "#60a5fa" },
            { icon: KPI_ICONS.clients, val: String(s?.customerCount ?? 0), label: "Active clients", change: "↑ growing", up: true, color: "#a78bfa" },
          ].map(({ icon, val, label, change, up, color }) => (
            <div key={label} className="kpi-card" style={{ padding: "14px 16px" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: T1, letterSpacing: "-0.02em", lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: up ? "#34d399" : "#fbbf24", marginTop: 3 }}>{change}</div>
            </div>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Revenue trend */}
            <Card style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T1 }}>Revenue trend</span>
                <span style={{ fontSize: 11, color: T3 }}>6 months</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={s?.revenueByMonth ?? []} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: T3 }} />
                  <YAxis tick={{ fontSize: 10, fill: T3 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#1a2035", border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 10, fontSize: 11 }} formatter={(v: number) => [formatCurrency(v), ""]} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#gr)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Active projects */}
            <Card style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T1 }}>Active projects</span>
                <Button asChild variant="ghost" size="sm"><Link href="/projects">View all</Link></Button>
              </div>
              {(s?.topClients ?? []).slice(0, 4).map((c, i) => {
                const pct = s?.totalRevenue > 0 ? Math.min(100, (c.total / s.totalRevenue) * 100 * 4) : 0;
                const colors = ["#6366f1", "#a78bfa", "#34d399", "#fbbf24"];
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: T2, fontWeight: 500 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: T3 }}>{formatCurrency(c.total)}</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: colors[i % 4], borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* Recent invoices */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 10px" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T1 }}>Recent invoices</span>
                <Button asChild variant="ghost" size="sm"><Link href="/invoices">View all →</Link></Button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                      {["Invoice", "Client", "Amount", "Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(s?.recentInvoices ?? []).map((inv: any, i: number) => (
                      <tr key={i} style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
                        <td style={{ padding: "9px 12px", color: "#818cf8", fontWeight: 500 }}>{inv.invoice_no}</td>
                        <td style={{ padding: "9px 12px", color: T2 }}>{inv.customer_name}</td>
                        <td style={{ padding: "9px 12px", color: T2, fontWeight: 500 }}>{formatCurrency(inv.total_amount, inv.currency)}</td>
                        <td style={{ padding: "9px 12px" }}><PaymentStatusBadge status={inv.payment_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Payment breakdown */}
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 10 }}>Payment breakdown</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={s?.paymentStatusBreakdown ?? []} cx="50%" cy="45%" innerRadius={55} outerRadius={78} dataKey="count" nameKey="status" paddingAngle={3}>
                    {(s?.paymentStatusBreakdown ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a2035", border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 10, fontSize: 11 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: T2 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === "analytics" && (
          <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card style={{ gridColumn: "1/-1", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 14 }}>Monthly revenue vs collected</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={s?.revenueByMonth ?? []} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: T3 }} />
                  <YAxis tick={{ fontSize: 10, fill: T3 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#1a2035", border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 10, fontSize: 11 }} formatter={(v: number) => [formatCurrency(v), ""]} />
                  <Bar dataKey="revenue" name="Invoiced" fill="rgba(99,102,241,0.7)" radius={[4,4,0,0]} />
                  <Bar dataKey="received" name="Collected" fill="rgba(52,211,153,0.7)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {[
              { label: "Total invoiced", value: formatCurrency(s?.totalRevenue ?? 0), color: "#818cf8" },
              { label: "Total collected", value: formatCurrency(s?.totalReceived ?? 0), color: "#34d399" },
              { label: "Collection rate", value: s?.totalRevenue ? `${Math.round((s.totalReceived / s.totalRevenue) * 100)}%` : "0%", color: "#60a5fa" },
              { label: "Total expenses", value: formatCurrency(s?.totalExpenses ?? 0), color: "#fbbf24" },
            ].map(({ label, value, color }) => (
              <div key={label} className="kpi-card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: T3, marginBottom: 6, letterSpacing: "0.05em" }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: "-0.02em" }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
