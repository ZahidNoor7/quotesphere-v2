"use client";

// Marketing motion primitives.
//
// Reveal / Stagger / StaggerItem / Rise / Float are CSS-driven (see the .mkt-*
// rules in globals.css): content is VISIBLE BY DEFAULT and only animates when the
// browser supports scroll-driven timelines AND the user allows motion. That makes
// them safe under no-JS, reduced-motion, SSR (no hydration mismatch — these render
// the same plain <div> on server and client), and LCP-critical above-the-fold use.
//
// SpotlightCard is the one genuinely interactive piece, so it uses `motion` to
// drive a cursor-following accent glow without re-rendering React on pointer move.
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fade + rise as the element scrolls into view (CSS scroll-timeline). */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mkt-reveal", className)}>{children}</div>;
}

/** Wrapper that gives its direct `StaggerItem` children a gentle reveal cascade. */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mkt-stagger", className)}>{children}</div>;
}

/** A single cascaded reveal item (must be a direct child of `Stagger`). */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mkt-reveal", className)}>{children}</div>;
}

/** One-shot mount entrance for above-the-fold hero content. `delay` in seconds. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("mkt-rise", className)}
      style={{ "--mkt-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Gentle perpetual float (CSS) to give the hero preview physical presence. */
export function Float({
  children,
  className,
  distance = 10,
  duration = 6,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <div
      className={cn("mkt-float", className)}
      style={
        {
          "--mkt-float-distance": `${distance}px`,
          "--mkt-float-duration": `${duration}s`,
          "--mkt-float-delay": `${delay}s`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Glass card with a cursor-following accent spotlight and a CSS hover-lift.
 * The spotlight is driven by motion values (no React re-render on pointer move);
 * the lift uses a CSS transition that the global reduced-motion reset neutralizes.
 * Renders identically on server and client (no conditional DOM), so no hydration
 * mismatch. The spotlight only appears on hover, so it is harmless at rest.
 */
export function SpotlightCard({
  children,
  className,
  contentClassName,
  lift = true,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  lift?: boolean;
}) {
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const background = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%)`;

  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      className={cn(
        "group/spot relative overflow-hidden rounded-[1.25rem] border backdrop-blur-xl transition-transform duration-300",
        lift && "hover:-translate-y-1.5",
        className,
      )}
      style={{ background: "var(--glass)", borderColor: "var(--glass-border)" }}
    >
      {/* top specular hairline */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--specular), transparent)",
        }}
      />
      {/* cursor spotlight (opacity gated by hover) */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background }}
      />
      <div className={cn("relative z-1 h-full", contentClassName)}>{children}</div>
    </div>
  );
}
