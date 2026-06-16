import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "./section";

export function FinalCta() {
  return (
    <Section>
      <div
        className="app-bg relative overflow-hidden rounded-3xl border px-6 py-16 text-center sm:px-10 sm:py-20"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <div className="relative z-[1] mx-auto flex max-w-2xl flex-col items-center">
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}
          >
            Ready to run your business in one place?
          </h2>
          <p className="mt-4 text-base sm:text-lg" style={{ color: "var(--t2)" }}>
            Create your workspace in minutes. Free to start, with a 14-day trial of every feature.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-6 text-[14px]">
              <Link href="/auth/register">
                Start free trial
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-6 text-[14px]">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
