import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Self-contained dark palette for the product "screenshot". Intentionally fixed
// (not theme-aware) so the preview reads as the real app chrome in both light
// and dark page themes.
const P = {
  t1: "#eef0ff",
  t2: "rgba(210,216,255,0.72)",
  t3: "rgba(160,170,255,0.42)",
  card: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.1)",
};

function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="QuoteSphere dashboard preview showing revenue, invoice and client stats"
      className="w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 45%,#0f0a2e 100%)",
        border: "0.5px solid rgba(255,255,255,0.14)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}
      >
        <span className="size-3 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="size-3 rounded-full" style={{ background: "#febc2e" }} />
        <span className="size-3 rounded-full" style={{ background: "#28c840" }} />
        <span className="ml-3 text-xs" style={{ color: P.t3 }}>
          app.quotesphere · Dashboard
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-semibold" style={{ color: P.t1 }}>
            Dashboard
          </span>
          <span className="text-xs" style={{ color: P.t3 }}>
            Jun 2026
          </span>
        </div>

        {/* KPI grid */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { v: "PKR 2.4M", l: "Revenue", c: "#34d399", sub: "+12%" },
            { v: "148", l: "Invoices", c: "#60a5fa", sub: "23 pending" },
            { v: "47", l: "Clients", c: "#a78bfa", sub: "5 new" },
            { v: "PKR 85K", l: "Outstanding", c: "#f87171", sub: "4 overdue" },
          ].map((k) => (
            <div
              key={k.l}
              className="rounded-xl px-3 py-2.5"
              style={{ background: P.card, border: `0.5px solid ${P.border}` }}
            >
              <div className="text-base font-bold" style={{ color: k.c }}>
                {k.v}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: P.t1 }}>
                {k.l}
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: P.t3 }}>
                {k.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Mini chart */}
        <div
          className="rounded-xl px-4 py-3.5"
          style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}
        >
          <div className="mb-2.5 text-[11px]" style={{ color: P.t3 }}>
            Revenue — last 6 months
          </div>
          <div className="flex h-16 items-end gap-2">
            {[55, 72, 48, 88, 65, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${h}%`,
                  background: i === 5 ? "#6366f1" : "rgba(99,102,241,0.35)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="app-bg relative overflow-hidden">
      <div className="relative z-[1] mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-16 pt-20 text-center sm:px-6 sm:pt-24 lg:pb-24">
        <span
          className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium"
          style={{
            color: "var(--accent2)",
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}
        >
          <Sparkles className="size-3.5" />
          Invoicing to payroll — one platform
        </span>

        <h1
          className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
          style={{ color: "var(--t1)", letterSpacing: "-0.03em" }}
        >
          Run your whole business{" "}
          <span
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            in one place
          </span>
        </h1>

        <p
          className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg"
          style={{ color: "var(--t2)" }}
        >
          QuoteSphere brings quoting, invoicing, expenses, projects, payroll and an
          AI assistant together — with pixel-perfect PDFs, dual-currency billing and
          strict per-tenant security built in from day one.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 px-6 text-[14px]">
            <Link href="/auth/register">
              Start free trial
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-6 text-[14px]">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs" style={{ color: "var(--t3)" }}>
          14-day free trial of every feature · No credit card required
        </p>

        <div className="mt-14 w-full max-w-3xl">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
