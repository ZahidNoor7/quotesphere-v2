import { cn } from "@/lib/utils";

/**
 * Content section wrapper: centered max-width container, responsive gutters, and
 * a scroll-margin so anchored nav links don't land under the sticky header.
 */
export function Section({
  id,
  className,
  containerClassName,
  children,
}: {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{ scrollMarginTop: 88 }}
      className={cn("relative px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24", className)}
    >
      <div className={cn("mx-auto w-full max-w-6xl", containerClassName)}>{children}</div>
    </section>
  );
}

/** Eyebrow + title + subtitle block shared across sections for a consistent rhythm. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
      )}
    >
      {eyebrow && (
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
          style={{
            color: "var(--accent2)",
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl"
        style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: "var(--t2)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
