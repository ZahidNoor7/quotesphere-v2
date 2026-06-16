"use client";

import { useState } from "react";
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

function AuthCtas() {
  const { status } = useSession();

  // Note: Button's `asChild` only forwards className to the child, so the CTAs
  // rely on navigation (which unmounts the sheet) rather than an onClick handler.
  if (status === "authenticated") {
    return (
      <Button asChild size="lg">
        <Link href="/dashboard">
          Go to dashboard
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="lg">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="lg">
        <Link href="/auth/register">
          Start free trial
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </>
  );
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="glass-surface sticky top-0 z-50 w-full border-b"
      style={{ borderColor: "var(--glass-border)" }}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" aria-label="QuoteSphere home" className="shrink-0">
          <Logo />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                scrollToAnchor(link.href);
              }}
              className="rounded-full px-3 py-2 text-sm font-medium transition-colors"
              style={{ color: "var(--t2)" }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 md:flex">
          <AuthCtas />
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
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
                      className="rounded-xl px-3 py-3 text-base font-medium transition-colors"
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
