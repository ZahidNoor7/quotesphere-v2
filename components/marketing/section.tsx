import { cn } from "@/lib/utils";
import { Reveal } from "./motion";

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
      style={{ scrollMarginTop: 96 }}
      className={cn("relative px-5 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32", className)}
    >
      <div className={cn("mx-auto w-full max-w-6xl", containerClassName)}>{children}</div>
    </section>
  );
}

/**
 * Eyebrow + title + subtitle block. Eyebrows are rationed across the page, so
 * most sections pass only `title` (+ optional `subtitle`). The whole block reveals
 * on scroll as one unit.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && (
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{
            color: "var(--accent-ink)",
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--accent) 28%, transparent)",
          }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-balance text-3xl font-bold leading-[1.05] sm:text-4xl lg:text-[2.85rem]",
          align === "center" ? "max-w-2xl" : "max-w-3xl",
        )}
        style={{ color: "var(--t1)", letterSpacing: "-0.025em" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="max-w-[60ch] text-pretty text-base leading-relaxed sm:text-lg"
          style={{ color: "var(--t2)" }}
        >
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
