import { Section, SectionHeading } from "./section";
import { FEATURE_MODULES } from "@/lib/marketing/content";

export function FeatureModules() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Everything you need"
        title="One platform for the whole back office"
        subtitle="Each module is built to stand on its own and work together — so your quotes, invoices, projects, people and reporting all share the same source of truth."
      />

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_MODULES.map(({ icon: Icon, title, blurb, tag }) => (
          <article key={title} className="glass-card flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex size-11 items-center justify-center rounded-xl"
                style={{
                  color: "var(--accent2)",
                  background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                  border: "0.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
                }}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--t3)" }}
              >
                {tag}
              </span>
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--t1)" }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--t2)" }}>
              {blurb}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
