"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { NAV_LINKS } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/** Smooth-scroll to an in-page anchor, respecting reduced-motion + the sticky nav. */
function scrollToAnchor(href: string) {
  if (!href.startsWith("#")) return;
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function AuthCtas({ size = "lg" as const }: { size?: "default" | "lg" }) {
  const { status } = useSession();

  // Note: Button's `asChild` only forwards className to the child, so the CTAs
  // rely on navigation (which unmounts the sheet) rather than an onClick handler.
  if (status === "authenticated") {
    return (
      <Button asChild size={size}>
        <Link href="/dashboard">
          Go to dashboard
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size={size}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size={size}>
        <Link href="/auth/register">
          Start free trial
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </>
  );
}

/** Highlights the nav link for whichever section is currently centered in view. */
function useScrollSpy(): string {
  const [active, setActive] = useState("");
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.slice(1));
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(`#${visible[0].target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.2, 0.5, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return active;
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const active = useScrollSpy();

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
      <nav
        className="glass-surface mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 rounded-full border py-2 pl-5 pr-2.5"
        style={{
          borderColor: "var(--glass-border)",
          boxShadow: "0 6px 24px -12px rgba(0,0,0,0.30)",
        }}
      >
        <Link
          href="/"
          aria-label="QuoteSphere home"
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
        >
          <Logo size={28} />
        </Link>

        {/* Desktop links */}
        <div className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = active === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToAnchor(link.href);
                }}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
                  isActive ? "bg-(--glass-hover)" : "hover:bg-(--glass-hover)",
                )}
                style={{ color: isActive ? "var(--accent-ink)" : "var(--t2)" }}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-1.5 md:flex">
          <AuthCtas />
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu" className="size-11">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="glass-surface w-[82%] max-w-xs border-l p-6"
              style={{ borderColor: "var(--glass-border)" }}
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="mb-8 flex">
                <Logo />
              </div>
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <a
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault();
                        setOpen(false);
                        // Wait for the sheet close animation before scrolling.
                        setTimeout(() => scrollToAnchor(link.href), 220);
                      }}
                      className="rounded-xl px-3 py-3 text-base font-medium transition-colors hover:bg-(--glass-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      style={{ color: "var(--t1)" }}
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <AuthCtas />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
