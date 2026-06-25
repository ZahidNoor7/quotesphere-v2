"use client";

import { Mail, MessageCircle, FileText, ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Stagger, StaggerItem, SpotlightCard } from "./motion";
import { FEATURE_MODULES } from "@/lib/marketing/content";

type Visual = "invoice" | "ai" | "chart" | "delivery";

// Explicit bento composition (6-col @ lg): rows of 3+3, 2+2+2, 3+3, 6.
// `i` indexes FEATURE_MODULES; ~half the tiles carry a small visual for rhythm.
const LAYOUT: { i: number; span: string; visual?: Visual }[] = [
  { i: 0, span: "lg:col-span-3", visual: "invoice" }, // Invoicing & quotations
  { i: 6, span: "lg:col-span-3", visual: "ai" }, // AI assistant
  { i: 5, span: "lg:col-span-2" }, // Payroll
  { i: 4, span: "lg:col-span-2", visual: "chart" }, // Reports & dashboards
  { i: 2, span: "lg:col-span-2" }, // Projects & time tracking
  { i: 1, span: "lg:col-span-3" }, // Expenses
  { i: 3, span: "lg:col-span-3" }, // Customers & services
  { i: 7, span: "lg:col-span-6" }, // Pixel-perfect document delivery (full width)
];

function IconPill({ icon: Icon }: { icon: typeof FileText }) {
  return (
    <span
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl"
      style={{
        color: "var(--accent2)",
        background: "color-mix(in srgb, var(--accent) 16%, transparent)",
        border: "0.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
      }}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function InvoiceVisual() {
  const rows = [
    { l: "Design retainer", a: "180,000" },
    { l: "Hosting · 12 mo", a: "96,000" },
    { l: "Tax (net)", a: "36,500" },
  ];
  return (
    <div
      className="mt-auto flex flex-col gap-2 rounded-xl p-3.5"
      style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)" }}
      aria-hidden
    >
      {rows.map((r) => (
        <div key={r.l} className="flex items-center justify-between text-[12px]">
          <span style={{ color: "var(--t2)" }}>{r.l}</span>
          <span className="tabular-nums" style={{ color: "var(--t2)" }}>
            {r.a}
          </span>
        </div>
      ))}
      <div
        className="mt-1 flex items-center justify-between border-t pt-2 text-[13px] font-semibold"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <span style={{ color: "var(--t1)" }}>Total</span>
        <span className="tabular-nums" style={{ color: "var(--accent2)" }}>
          PKR 312,500
        </span>
      </div>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="mt-auto flex flex-col gap-2" aria-hidden>
      <div
        className="self-end rounded-xl rounded-br-sm px-3 py-2 text-[12px]"
        style={{
          background: "color-mix(in srgb, var(--accent) 18%, transparent)",
          color: "var(--t1)",
        }}
      >
        Add 15% tax and email it
      </div>
      <div
        className="self-start rounded-xl rounded-bl-sm px-3 py-2 text-[12px]"
        style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)", color: "var(--t2)" }}
      >
        Updated the totals. Confirm to save and send?
      </div>
    </div>
  );
}

function ChartVisual() {
  return (
    <div className="mt-auto flex h-14 items-end gap-1.5" aria-hidden>
      {[40, 62, 50, 78, 58, 92].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{
            height: `${h}%`,
            background:
              i === 5
                ? "var(--accent)"
                : "color-mix(in srgb, var(--accent) 32%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

function DeliveryVisual() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span
        className="inline-flex size-12 items-center justify-center rounded-xl"
        style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)", color: "var(--t2)" }}
      >
        <FileText className="size-5" />
      </span>
      <ArrowRight className="size-4 shrink-0" style={{ color: "var(--t2)" }} aria-hidden />
      {[Mail, MessageCircle].map((Icon, i) => (
        <span
          key={i}
          className="inline-flex size-12 items-center justify-center rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--accent) 26%, transparent)",
            color: "var(--accent2)",
          }}
        >
          <Icon className="size-5" />
        </span>
      ))}
    </div>
  );
}

const VISUALS: Record<Visual, () => React.ReactElement> = {
  invoice: InvoiceVisual,
  ai: AiVisual,
  chart: ChartVisual,
  delivery: DeliveryVisual,
};

export function FeatureModules() {
  return (
    <Section id="features">
      <SectionHeading
        align="left"
        eyebrow="Everything you need"
        title="One platform for the whole back office"
        subtitle="Each module stands on its own and works together, so your quotes, invoices, projects, people and reporting share a single source of truth."
      />

      <Stagger className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {LAYOUT.map(({ i, span, visual }) => {
          const { icon, title, blurb, tag } = FEATURE_MODULES[i];
          const isWide = span === "lg:col-span-6";
          const VisualEl = visual ? VISUALS[visual] : null;

          // Full-width tile: horizontal split (copy left, channels right).
          if (isWide) {
            return (
              <StaggerItem key={title} className={`col-span-1 ${span}`}>
                <SpotlightCard contentClassName="flex h-full flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                  <div className="flex max-w-xl flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <IconPill icon={icon} />
                      <span className="text-xs font-medium" style={{ color: "var(--t2)" }}>
                        {tag}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-semibold" style={{ color: "var(--t1)" }}>
                        {title}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--t2)" }}>
                        {blurb}
                      </p>
                    </div>
                  </div>
                  {VisualEl && <VisualEl />}
                </SpotlightCard>
              </StaggerItem>
            );
          }

          return (
            <StaggerItem key={title} className={`col-span-1 ${span}`}>
              <SpotlightCard contentClassName="flex h-full flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <IconPill icon={icon} />
                  <span className="text-xs font-medium" style={{ color: "var(--t2)" }}>
                    {tag}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold" style={{ color: "var(--t1)" }}>
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--t2)" }}>
                    {blurb}
                  </p>
                </div>
                {VisualEl && <VisualEl />}
              </SpotlightCard>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
}
