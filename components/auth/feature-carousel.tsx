"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const T1 = "#eef0ff";
const T2 = "rgba(210,216,255,0.72)";
const T3 = "rgba(160,170,255,0.42)";

function DashboardMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Dashboard</span>
        <span style={{ fontSize: 12, color: T3 }}>Apr 2026</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { v: "PKR 2.4M", l: "Revenue", c: "#34d399", sub: "+12% this month" },
          { v: "148", l: "Invoices", c: "#60a5fa", sub: "23 pending" },
          { v: "47", l: "Clients", c: "#a78bfa", sub: "5 new this week" },
          { v: "PKR 85K", l: "Outstanding", c: "#f87171", sub: "4 overdue" },
        ].map(({ v, l, c, sub }) => (
          <div key={l} style={{ background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 15px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: T1, marginTop: 2 }}>{l}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "13px 15px" }}>
        <div style={{ fontSize: 12, color: T3, marginBottom: 10 }}>Revenue — Last 6 months</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 64 }}>
          {[55, 72, 48, 88, 65, 100].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0", background: i === 5 ? "#6366f1" : "rgba(99,102,241,0.35)" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
          {["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"].map(m => (
            <span key={m} style={{ fontSize: 11, color: T3 }}>{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvoicesMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Invoices</span>
        <div style={{ fontSize: 11, padding: "3px 12px", borderRadius: 7, background: "#6366f1", color: "#fff", fontWeight: 500 }}>+ New</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { id: "INV-042", client: "Farooqi Interiors", amt: "PKR 65,500", status: "Paid", sc: "#34d399", bg: "rgba(52,211,153,0.12)" },
          { id: "INV-041", client: "TechSolutions PK", amt: "PKR 28,000", status: "Pending", sc: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
          { id: "INV-040", client: "Al-Noor Builders", amt: "PKR 1,12,000", status: "Overdue", sc: "#f87171", bg: "rgba(248,113,113,0.12)" },
          { id: "INV-039", client: "Metro Corporation", amt: "PKR 44,500", status: "Paid", sc: "#34d399", bg: "rgba(52,211,153,0.12)" },
        ].map(inv => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "10px 13px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{inv.id}</div>
              <div style={{ fontSize: 11, color: T3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.client}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginRight: 10 }}>{inv.amt}</div>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 100, background: inv.bg, color: inv.sc, border: `0.5px solid ${inv.sc}44`, whiteSpace: "nowrap" }}>{inv.status}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
        {[{ v: "PKR 2.4M", l: "Total Billed", c: "#818cf8" }, { v: "23", l: "Pending", c: "#fbbf24" }, { v: "4", l: "Overdue", c: "#f87171" }].map(({ v, l, c }) => (
          <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuotationsMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Quotations</span>
        <span style={{ fontSize: 12, color: T3 }}>6 active</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { id: "QUO-018", client: "Sunrise Properties", amt: "PKR 3,20,000", status: "Sent", sc: "#60a5fa", bg: "rgba(96,165,250,0.12)", items: 8 },
          { id: "QUO-017", client: "Green Valley Farm", amt: "PKR 55,000", status: "Accepted", sc: "#34d399", bg: "rgba(52,211,153,0.12)", items: 4 },
          { id: "QUO-016", client: "City Developers", amt: "PKR 7,80,000", status: "Draft", sc: "#a78bfa", bg: "rgba(167,139,250,0.12)", items: 15 },
        ].map(q => (
          <div key={q.id} style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "13px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{q.id}</div>
                <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>{q.client}</div>
              </div>
              <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 100, background: q.bg, color: q.sc }}>{q.status}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>{q.amt}</span>
              <span style={{ fontSize: 11, color: T3 }}>{q.items} line items</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Projects</span>
        <span style={{ fontSize: 12, color: T3 }}>5 active</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { name: "Office Renovation", client: "Farooqi Interiors", progress: 78, c: "#6366f1", budget: "PKR 450K" },
          { name: "Website Redesign", client: "TechSolutions PK", progress: 45, c: "#60a5fa", budget: "PKR 120K" },
          { name: "Warehouse Build", client: "Metro Corporation", progress: 100, c: "#34d399", budget: "PKR 1.2M" },
          { name: "Interior Fit-out", client: "Al-Noor Builders", progress: 22, c: "#fbbf24", budget: "PKR 280K" },
        ].map(p => (
          <div key={p.name} style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "11px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{p.client}</div>
              </div>
              <div style={{ textAlign: "right", marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: p.c }}>{p.progress}%</div>
                <div style={{ fontSize: 11, color: T3 }}>{p.budget}</div>
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${p.progress}%`, background: p.c, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpensesMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Expenses</span>
        <span style={{ fontSize: 12, color: T3 }}>Apr 2026</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 15px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: T3, marginBottom: 3 }}>Total this month</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#f87171" }}>PKR 1,14,000</div>
          <div style={{ fontSize: 11, color: "#f87171", marginTop: 3, opacity: 0.8 }}>↑ 8% vs last month</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: T3, marginBottom: 3 }}>Budget</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>PKR 1,50,000</div>
          <div style={{ fontSize: 11, color: "#34d399", marginTop: 3, opacity: 0.8 }}>76% used</div>
        </div>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: "76%", background: "linear-gradient(90deg,#6366f1,#f87171)", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {[
          { l: "Materials", v: "PKR 48,000", pct: 42, c: "#6366f1" },
          { l: "Labour", v: "PKR 32,000", pct: 28, c: "#60a5fa" },
          { l: "Transport", v: "PKR 18,000", pct: 16, c: "#a78bfa" },
          { l: "Utilities", v: "PKR 16,000", pct: 14, c: "#f87171" },
        ].map(cat => (
          <div key={cat.l}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: T2 }}>{cat.l}</span>
              <span style={{ fontSize: 12, color: T1, fontWeight: 500 }}>{cat.v}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3 }}>
              <div style={{ height: "100%", width: `${cat.pct}%`, background: cat.c, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptsMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Receipts</span>
        <span style={{ fontSize: 12, color: T3 }}>12 this month</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "16px", position: "relative", overflow: "hidden", marginBottom: 10 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: T3, letterSpacing: "0.07em" }}>RECEIPT</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T1, marginTop: 3 }}>RCP-0087</div>
              <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Farooqi Interiors</div>
            </div>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(52,211,153,0.15)", color: "#6ee7b7", border: "0.5px solid rgba(52,211,153,0.25)" }}>Issued</span>
          </div>
          {[["Office supplies", "PKR 4,200"], ["Site materials", "PKR 18,500"], ["Miscellaneous", "PKR 1,800"]].map(([item, amt]) => (
            <div key={item} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: 12, color: T2 }}>{item}</span>
              <span style={{ fontSize: 12, color: T1, fontWeight: 500 }}>{amt}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(99,102,241,0.3)" }}>
            <span style={{ fontSize: 13, color: T3 }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#818cf8" }}>PKR 24,500</span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[{ v: "PKR 2.1M", l: "All Time", c: "#818cf8" }, { v: "847", l: "Receipts", c: "#60a5fa" }, { v: "63", l: "Clients", c: "#a78bfa" }].map(({ v, l, c }) => (
          <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  { id: "dashboard", title: "Your business at a glance", subtitle: "Real-time revenue, invoices, clients and outstanding amounts — all on one screen.", Component: DashboardMock },
  { id: "invoices", title: "Smart invoicing", subtitle: "Create professional invoices in seconds and track every payment status effortlessly.", Component: InvoicesMock },
  { id: "quotations", title: "Win more clients", subtitle: "Send polished quotations that convert. Track accepted, pending and draft quotes.", Component: QuotationsMock },
  { id: "projects", title: "Project tracking", subtitle: "Monitor progress, budgets and deadlines across all your active projects.", Component: ProjectsMock },
  { id: "expenses", title: "Expense management", subtitle: "Categorize spending, set budgets and stay profitable with clear cost breakdowns.", Component: ExpensesMock },
  { id: "receipts", title: "Digital receipts", subtitle: "Issue and manage receipts for every transaction — searchable, organised, instant.", Component: ReceiptsMock },
];

export function FeatureCarousel() {
  const [displayActive, setDisplayActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const activeRef = useRef(0);
  const isPausedRef = useRef(false);

  const goTo = useCallback((idx: number) => {
    if (idx === activeRef.current) return;
    setVisible(false);
    setTimeout(() => {
      activeRef.current = idx;
      setDisplayActive(idx);
      setVisible(true);
    }, 220);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPausedRef.current) {
        const next = (activeRef.current + 1) % SLIDES.length;
        goTo(next);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [goTo]);

  const slide = SLIDES[displayActive];

  return (
    <div
      className="auth-carousel-panel"
      onMouseEnter={() => { isPausedRef.current = true; }}
      onMouseLeave={() => { isPausedRef.current = false; }}
      style={{
        background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 40%,#0f0a2e 100%)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow orbs */}
      <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)", top: -200, right: -100, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle,rgba(167,139,250,0.12) 0%,transparent 70%)", bottom: -100, left: 40, pointerEvents: "none" }} />

      {/* Slide mock UI */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "36px 52px", position: "relative", zIndex: 5 }}>
        <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.22s ease", width: "100%", maxWidth: 480 }}>
          <slide.Component />
        </div>
      </div>

      {/* Bottom: title, subtitle, dots */}
      <div style={{ padding: "0 52px 40px", position: "relative", zIndex: 5 }}>
        <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.22s ease", minHeight: 80 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 8 }}>
            {slide.title}
          </h2>
          <p style={{ fontSize: 13.5, color: T3, lineHeight: 1.7, margin: 0 }}>
            {slide.subtitle}
          </p>
        </div>
        {/* Dots */}
        <div style={{ display: "flex", gap: 6, marginTop: 18, alignItems: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === displayActive ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === displayActive ? "#6366f1" : "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.3s ease",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
