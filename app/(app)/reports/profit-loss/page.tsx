"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { T1, T2, T3, TOPBAR_STYLE } from "@/lib/ds";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

const THIS_YEAR = new Date().getFullYear();
const PERIODS = [
  { label: "This month", from: new Date(THIS_YEAR, new Date().getMonth(), 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
  { label: "Q1", from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-03-31` },
  { label: "Q2", from: `${THIS_YEAR}-04-01`, to: `${THIS_YEAR}-06-30` },
  { label: "Q3", from: `${THIS_YEAR}-07-01`, to: `${THIS_YEAR}-09-30` },
  { label: "Q4", from: `${THIS_YEAR}-10-01`, to: `${THIS_YEAR}-12-31` },
  { label: `FY ${THIS_YEAR}`, from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-12-31` },
];

type PnLData = {
  totalRevenue: number;
  totalReceived: number;
  totalExpenses: number;
  grossProfit: number;
  grossMargin: number;
  invoiceCount: number;
  expenseCount: number;
  monthly: { label: string; revenue: number; received: number; expenses: number; profit: number }[];
  expensesByCategory: { category: string; total: number }[];
  isLoss: boolean;
};

export default function ProfitLossPage() {
  const { settings } = useSettings();
  const currency = settings?.default_currency ?? "PKR";
  const [periodIdx, setPeriodIdx] = useState(5); // default: FY

  const period = PERIODS[periodIdx];
  const apiUrl = useMemo(
    () => `/api/reports/profit-loss?from=${period.from}&to=${period.to}`,
    [period]
  );

  const { data, isLoading } = useSWR<PnLData>(apiUrl, fetcher, { revalidateOnFocus: false });

  const profitColor = data?.isLoss ? "#f87171" : "#34d399";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <Link href="/reports" style={{ display: "flex", alignItems: "center", gap: 6, color: T2, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={14} /> Reports
        </Link>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginLeft: 12 }}>Profit & Loss</div>
        <div style={{ marginLeft: "auto" }}>
          <Select value={String(periodIdx)} onValueChange={v => setPeriodIdx(Number(v))}>
            <SelectTrigger style={{ width: 140, fontSize: 12 }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p, i) => (
                <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflowY: "auto" }}>
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* Summary KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Revenue", value: formatCurrency(data.totalRevenue, currency), color: "#818cf8", sub: `${data.invoiceCount} invoices` },
                { label: "Expenses", value: formatCurrency(data.totalExpenses, currency), color: "#fbbf24", sub: `${data.expenseCount} expense records` },
                { label: "Gross Profit", value: formatCurrency(data.grossProfit, currency), color: profitColor, sub: data.isLoss ? "Operating at a loss" : "Net positive" },
                { label: "Gross Margin", value: `${data.grossMargin}%`, color: profitColor, sub: data.isLoss ? "Below breakeven" : "Healthy margin" },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="kpi-card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: T3, marginBottom: 4, letterSpacing: "0.05em" }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color, letterSpacing: "-0.02em" }}>{value}</div>
                  <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Profit indicator banner */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              borderRadius: 10, marginBottom: 20,
              background: data.isLoss ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
              border: `0.5px solid ${data.isLoss ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
            }}>
              {data.isLoss
                ? <TrendingDown size={16} color="#f87171" />
                : <TrendingUp size={16} color="#34d399" />}
              <span style={{ fontSize: 13, fontWeight: 500, color: profitColor }}>
                {data.isLoss
                  ? `Operating at a loss of ${formatCurrency(Math.abs(data.grossProfit), currency)} for ${period.label}`
                  : `Profitable: ${formatCurrency(data.grossProfit, currency)} gross profit for ${period.label}`}
              </span>
            </div>

            {/* Monthly P&L bar chart */}
            {data.monthly.length > 0 && (
              <Card style={{ padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 14 }}>
                  Monthly Revenue vs Expenses
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.monthly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: T3 }} />
                    <YAxis tick={{ fontSize: 10, fill: T3 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#1a2035", border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 10, fontSize: 11 }}
                      formatter={(v) => [formatCurrency(typeof v === "number" ? v : 0, currency), ""]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: T2 }} />
                    <Bar dataKey="revenue"  name="Revenue"  fill="rgba(99,102,241,0.7)"  radius={[4,4,0,0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="rgba(251,191,36,0.7)"  radius={[4,4,0,0]} />
                    <Bar dataKey="profit"   name="Profit"   fill="rgba(52,211,153,0.7)"  radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Expense breakdown */}
            {data.expensesByCategory.length > 0 && (
              <Card style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 14 }}>
                  Expense breakdown by category
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.expensesByCategory.map((cat, i) => {
                    const pct = data.totalExpenses > 0 ? (cat.total / data.totalExpenses) * 100 : 0;
                    const colors = ["#6366f1","#fbbf24","#fb923c","#f87171","#34d399","#60a5fa","#a78bfa","#2dd4bf"];
                    const color = colors[i % colors.length];
                    return (
                      <div key={cat.category}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: T2 }}>{cat.category}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: T1 }}>
                            {formatCurrency(cat.total, currency)} <span style={{ color: T3, fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 10, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
