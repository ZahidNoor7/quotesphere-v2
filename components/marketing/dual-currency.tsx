import { Banknote, Lock } from "lucide-react";
import { Section } from "./section";

export function DualCurrency() {
  return (
    <Section>
      <div className="glass-card grid grid-cols-1 items-center gap-10 p-8 sm:p-10 lg:grid-cols-2 lg:p-14">
        <div className="flex flex-col gap-4">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{
              color: "var(--accent2)",
              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            <Banknote className="size-3.5" />
            Dual-currency
          </span>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}
          >
            Bill in PKR and USD, without the guesswork
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "var(--t2)" }}>
            Quote local clients in rupees and international clients in dollars from the
            same workspace. Every document captures its exchange rate at issue time, so
            your totals and reports stay accurate no matter how rates move afterward.
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--t3)" }}>
            <Lock className="size-4" aria-hidden />
            Rates frozen per document — history never silently changes
          </div>
        </div>

        {/* Visual: same total, two currencies */}
        <div className="flex flex-col gap-3" aria-hidden>
          {[
            { cur: "PKR", amount: "312,500", note: "Local invoice" },
            { cur: "USD", amount: "1,120.00", note: "Export invoice" },
          ].map((row) => (
            <div
              key={row.cur}
              className="flex items-center justify-between rounded-2xl px-5 py-4"
              style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex size-10 items-center justify-center rounded-xl text-xs font-bold"
                  style={{
                    color: "var(--accent2)",
                    background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                  }}
                >
                  {row.cur}
                </span>
                <span className="text-sm" style={{ color: "var(--t3)" }}>
                  {row.note}
                </span>
              </div>
              <span className="text-xl font-bold" style={{ color: "var(--t1)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--t3)" }}>
                  {row.cur}{" "}
                </span>
                {row.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
