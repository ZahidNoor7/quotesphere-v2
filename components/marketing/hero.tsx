"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Rise, Float } from "./motion";

// Self-contained dark palette for the product "preview". Intentionally fixed
// (not theme-aware) so it reads as the real app chrome in both light and dark
// page themes — a product screenshot keeps its own colors.
const P = {
  t1: "#eef0ff",
  t2: "rgba(210,216,255,0.72)",
  t3: "rgba(160,170,255,0.46)",
  card: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.1)",
  accent: "#6366f1",
};

function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="QuoteSphere dashboard preview showing revenue, invoice and client stats"
      className="w-full overflow-hidden rounded-[1.5rem]"
      style={{
        background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 45%,#0f0a2e 100%)",
        border: "0.5px solid rgba(255,255,255,0.14)",
        boxShadow: "0 30px 80px -24px rgba(0,0,0,0.7)",
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
              <div className="text-base font-bold tabular-nums" style={{ color: k.c }}>
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
            Revenue, last 6 months
          </div>
          <div className="flex h-16 items-end gap-2">
            {[55, 72, 48, 88, 65, 100].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${h}%`,
                  background: i === 5 ? P.accent : "rgba(99,102,241,0.35)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Floating AI-assistant chip — gives the preview Z-axis depth. */
function AiChip() {
  return (
    <div
      className="flex w-[15rem] items-start gap-2.5 rounded-2xl p-3.5"
      style={{
        background: "rgba(13,18,38,0.92)",
        border: "0.5px solid rgba(255,255,255,0.14)",
        boxShadow: "0 18px 44px -16px rgba(0,0,0,0.65)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span
        className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "rgba(99,102,241,0.18)", color: "#a5b4fc" }}
      >
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium" style={{ color: P.t1 }}>
          AI assistant
        </p>
        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: P.t2 }}>
          Drafted a quotation for Cedar &amp; Co. Review before it&apos;s saved.
        </p>
      </div>
    </div>
  );
}

/** Floating payment-received chip. */
function PaidChip() {
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
      style={{
        background: "rgba(13,18,38,0.92)",
        border: "0.5px solid rgba(255,255,255,0.14)",
        boxShadow: "0 18px 44px -16px rgba(0,0,0,0.65)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span
        className="inline-flex size-7 items-center justify-center rounded-full"
        style={{ background: "rgba(52,211,153,0.18)", color: "#34d399" }}
      >
        <Check className="size-4" />
      </span>
      <div>
        <p className="text-[11px] font-medium" style={{ color: P.t1 }}>
          Payment received
        </p>
        <p className="text-[11px] tabular-nums" style={{ color: P.t3 }}>
          PKR 312,500 · Invoice #INV-2041
        </p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="app-bg mkt-grain relative overflow-hidden">
      <div className="relative z-1 mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-28 lg:pt-32">
        {/* LEFT — copy */}
        <div className="flex flex-col items-start text-left">
          <Rise>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium"
              style={{
                color: "var(--accent-ink)",
                background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                border: "0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              }}
            >
              <Sparkles className="size-3.5" />
              Invoicing to payroll, one platform
            </span>
          </Rise>

          <Rise delay={0.08}>
            <h1
              className="mt-6 max-w-xl text-balance text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl"
              style={{ color: "var(--t1)", letterSpacing: "-0.035em" }}
            >
              Run your whole business{" "}
              <span
                style={{
                  background: "linear-gradient(120deg, var(--accent), var(--accent2))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                in one place
              </span>
            </h1>
          </Rise>

          <Rise delay={0.16}>
            <p
              className="mt-6 max-w-md text-pretty text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--t2)" }}
            >
              Quoting, invoicing, expenses, projects and payroll in one workspace,
              with an AI assistant, pixel-perfect PDFs and dual-currency billing.
            </p>
          </Rise>

          <Rise delay={0.24}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 px-6 text-[14px]">
                <Link href="/auth/register">
                  Start free trial
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-6 text-[14px]">
                <a
                  href="#features"
                  onClick={(e) => {
                    e.preventDefault();
                    const reduce = window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches;
                    document.getElementById("features")?.scrollIntoView({
                      behavior: reduce ? "auto" : "smooth",
                      block: "start",
                    });
                  }}
                >
                  Explore the platform
                </a>
              </Button>
            </div>
          </Rise>
        </div>

        {/* RIGHT — elevated product preview with floating depth cards */}
        <Rise delay={0.2} className="relative">
          {/* accent halo behind the frame */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-1 rounded-[2.5rem] opacity-70 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 70% 30%, var(--accent-glow), transparent 70%)",
            }}
          />
          <Float distance={12} duration={7}>
            <DashboardPreview />
          </Float>

          {/* Floating chips (desktop only — they overhang the frame for depth) */}
          <Float
            distance={9}
            duration={5.5}
            delay={0.4}
            className="absolute -right-4 top-10 z-2 hidden xl:block"
          >
            <AiChip />
          </Float>
          <Float
            distance={8}
            duration={6.5}
            delay={0.8}
            className="absolute -left-6 bottom-8 z-2 hidden xl:block"
          >
            <PaidChip />
          </Float>
        </Rise>
      </div>
    </section>
  );
}
