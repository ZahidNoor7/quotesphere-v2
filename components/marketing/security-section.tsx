import { Section, SectionHeading } from "./section";
import { SECURITY_POINTS } from "@/lib/marketing/content";

export function SecuritySection() {
  return (
    <Section id="security">
      <SectionHeading
        eyebrow="Built for trust"
        title="Security that earns a business's confidence"
        subtitle="QuoteSphere is multi-tenant by design — your data, your team's access and your compliance trail are first-class concerns, not afterthoughts."
      />

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
        {SECURITY_POINTS.map(({ icon: Icon, title, blurb }) => (
          <article key={title} className="glass-card flex gap-4 p-6">
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
          </article>
        ))}
      </div>
    </Section>
  );
}
