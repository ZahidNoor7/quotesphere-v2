import { Snowflake, ArrowLeftRight } from "lucide-react";
import { Section } from "./section";
import { Reveal, Stagger, StaggerItem } from "./motion";

type Row = { cur: string; amount: string; note: string; rate: string };

const ROWS: Row[] = [
  { cur: "PKR", amount: "312,500", note: "Local invoice", rate: "rate frozen @ 279.02" },
  { cur: "USD", amount: "1,120.00", note: "Export invoice", rate: "rate frozen @ 279.02" },
];

function CurrencyCard({ row }: { row: Row }) {
  return (
    <div
      className="flex h-full flex-col justify-between gap-4 rounded-2xl p-5"
      style={{
        background: "var(--glass)",
        border: "0.5px solid var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex size-10 items-center justify-center rounded-xl text-xs font-bold"
          style={{
            color: "var(--accent2)",
            background: "color-mix(in srgb, var(--accent) 16%, transparent)",
          }}
        >
          {row.cur}
        </span>
        <span className="text-sm" style={{ color: "var(--t2)" }}>
          {row.note}
        </span>
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--t1)" }}>
          <span className="text-base font-medium" style={{ color: "var(--t2)" }}>
            {row.cur}{" "}
          </span>
          {row.amount}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--t2)" }}>
          <Snowflake className="size-3.5" style={{ color: "var(--accent2)" }} aria-hidden />
          {row.rate}
        </div>
      </div>
    </div>
  );
}

export function DualCurrency() {
  return (
    <Section>
      <Reveal>
        <div
          className="mkt-grain relative overflow-hidden rounded-3xl border p-8 sm:p-12 lg:p-14"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent2) 8%, transparent))",
            borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
          }}
        >
          {/* ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full blur-3xl"
            style={{ background: "var(--accent-glow)" }}
          />

          <div className="relative z-1 flex flex-col gap-10">
            <div className="flex max-w-2xl flex-col gap-4">
              <h2
                className="text-balance text-3xl font-bold leading-[1.06] sm:text-4xl lg:text-[2.85rem]"
                style={{ color: "var(--t1)", letterSpacing: "-0.025em" }}
              >
                Bill in PKR and USD, without the guesswork
              </h2>
              <p className="text-pretty text-base leading-relaxed sm:text-lg" style={{ color: "var(--t2)" }}>
                Quote local clients in rupees and international clients in dollars from
                one workspace. Every document captures its exchange rate at issue time,
                so totals and reports stay accurate no matter how rates move later.
              </p>
            </div>

            <Stagger className="grid items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <StaggerItem className="h-full">
                <CurrencyCard row={ROWS[0]} />
              </StaggerItem>
              <StaggerItem className="hidden items-center justify-center sm:flex">
                <span
                  className="inline-flex size-10 items-center justify-center rounded-full"
                  style={{
                    color: "var(--accent2)",
                    background: "var(--glass)",
                    border: "0.5px solid var(--glass-border)",
                  }}
                >
                  <ArrowLeftRight className="size-4" aria-hidden />
                </span>
              </StaggerItem>
              <StaggerItem className="h-full">
                <CurrencyCard row={ROWS[1]} />
              </StaggerItem>
            </Stagger>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
