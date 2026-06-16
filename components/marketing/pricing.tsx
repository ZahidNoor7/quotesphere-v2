"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "./section";
import type { PublicPlan } from "@/types";

type Cur = "PKR" | "USD";

function priceParts(plan: PublicPlan, cur: Cur): { main: string; suffix: string } {
  const amount = cur === "PKR" ? plan.pricePkr : plan.priceUsd;
  if (amount <= 0) {
    return { main: "Free", suffix: plan.billingInterval === "lifetime" ? "forever" : "" };
  }
  const formatted = amount.toLocaleString("en-US");
  const main = cur === "PKR" ? `PKR ${formatted}` : `$${formatted}`;
  const suffix =
    plan.billingInterval === "monthly"
      ? "/mo"
      : plan.billingInterval === "annual"
        ? "/yr"
        : "one-time";
  return { main, suffix };
}

export function Pricing({ plans }: { plans: PublicPlan[] }) {
  const [cur, setCur] = useState<Cur>("PKR");

  // Highlight the priciest tier as "most popular".
  const popularSlug = useMemo(() => {
    let top: PublicPlan | null = null;
    for (const p of plans) {
      if (p.priceUsd > 0 && (!top || p.priceUsd > top.priceUsd)) top = p;
    }
    return top?.slug ?? null;
  }, [plans]);

  return (
    <Section id="pricing">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple plans that grow with you"
        subtitle="Start free, then add modules as you need them. Every paid plan includes a 14-day free trial of all features — no credit card required."
      />

      {/* Currency toggle */}
      <div className="mt-8 flex justify-center">
        <div
          className="inline-flex items-center gap-1 rounded-full p-1"
          role="group"
          aria-label="Choose currency"
          style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)" }}
        >
          {(["PKR", "USD"] as const).map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={c === cur ? "default" : "ghost"}
              aria-pressed={c === cur}
              onClick={() => setCur(c)}
              className="rounded-full px-5"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const popular = plan.slug === popularSlug;
          const { main, suffix } = priceParts(plan, cur);
          const prev = i > 0 ? plans[i - 1] : null;
          const prevKeys = new Set(prev?.features.map((f) => f.key));
          const shownFeatures = prev
            ? plan.features.filter((f) => !prevKeys.has(f.key))
            : plan.features;

          return (
            <div
              key={plan.slug}
              className="glass-card relative flex h-full flex-col gap-6 p-7"
              style={
                popular
                  ? {
                      borderColor: "color-mix(in srgb, var(--accent) 55%, transparent)",
                      boxShadow: "0 8px 40px var(--accent-glow)",
                    }
                  : undefined
              }
            >
              {popular && (
                <span
                  className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}
                >
                  <Sparkles className="size-3" />
                  Most popular
                </span>
              )}

              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold" style={{ color: "var(--t1)" }}>
                  {plan.name}
                </h3>
                <p className="min-h-10 text-sm leading-relaxed" style={{ color: "var(--t3)" }}>
                  {plan.description}
                </p>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight" style={{ color: "var(--t1)" }}>
                  {main}
                </span>
                {suffix && (
                  <span className="text-sm font-medium" style={{ color: "var(--t3)" }}>
                    {suffix}
                  </span>
                )}
              </div>

              <Button
                asChild
                size="lg"
                variant={popular ? "default" : "outline"}
                className="h-11 w-full"
              >
                <Link href="/auth/register">
                  {plan.pricePkr <= 0 && plan.priceUsd <= 0 ? "Get started" : "Start free trial"}
                </Link>
              </Button>

              <div className="flex flex-col gap-3">
                {prev && (
                  <span className="text-xs font-medium" style={{ color: "var(--t2)" }}>
                    Everything in {prev.name}, plus:
                  </span>
                )}
                <ul className="flex flex-col gap-2.5">
                  {shownFeatures.map((f) => (
                    <li key={f.key} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 size-4 shrink-0"
                        style={{ color: "var(--accent2)" }}
                        aria-hidden
                      />
                      <span className="text-sm" style={{ color: "var(--t2)" }}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm" style={{ color: "var(--t3)" }}>
        Dashboard, team management and settings are included on every plan. Prices shown in {cur}.
      </p>
    </Section>
  );
}
