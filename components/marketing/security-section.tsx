import { ShieldCheck, Lock, Ban } from "lucide-react";
import { Section, SectionHeading } from "./section";
import { Stagger, StaggerItem, Reveal } from "./motion";
import { SECURITY_POINTS } from "@/lib/marketing/content";

/** Compact diagram of per-tenant isolation: your lane is open, others are blocked. */
function IsolationVisual() {
  return (
    <Reveal className="mt-9 flex flex-col gap-2.5">
      <div
        className="flex flex-col gap-2.5 rounded-2xl p-5"
        style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)" }}
      >
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
          }}
        >
          <span className="flex items-center gap-2.5 text-sm font-medium" style={{ color: "var(--t1)" }}>
            <ShieldCheck className="size-4" style={{ color: "var(--accent2)" }} aria-hidden />
            Your organization
          </span>
          <Lock className="size-4" style={{ color: "var(--accent2)" }} aria-hidden />
        </div>

        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "var(--glass)", border: "0.5px dashed var(--glass-border-strong)" }}
        >
          <span className="flex items-center gap-2.5 text-sm" style={{ color: "var(--t2)" }}>
            <Ban className="size-4" aria-hidden />
            Any other tenant
          </span>
          <span className="text-xs" style={{ color: "var(--t2)" }}>
            blocked
          </span>
        </div>
      </div>
      <p className="px-1 text-xs leading-relaxed" style={{ color: "var(--t2)" }}>
        A query with no organization context is rejected, not guessed.
      </p>
    </Reveal>
  );
}

export function SecuritySection() {
  return (
    <Section id="security">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* LEFT — sticky heading + isolation diagram */}
        <div className="self-start lg:sticky lg:top-28">
          <SectionHeading
            align="left"
            title="Security that earns a business's confidence"
            subtitle="QuoteSphere is multi-tenant by design. Your data, your team's access and your compliance trail are first-class concerns, not afterthoughts."
          />
          <IsolationVisual />
        </div>

        {/* RIGHT — divided list (a different layout family from the bento above) */}
        <Stagger className="flex flex-col">
          {SECURITY_POINTS.map(({ icon: Icon, title, blurb }, idx) => (
            <StaggerItem
              key={title}
              className={
                idx === 0
                  ? "flex gap-4 pb-7"
                  : "flex gap-4 border-t border-(--glass-border) py-7 last:pb-0"
              }
            >
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
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold" style={{ color: "var(--t1)" }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--t2)" }}>
                  {blurb}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
