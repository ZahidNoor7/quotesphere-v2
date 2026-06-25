import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "./section";
import { Reveal } from "./motion";

export function FinalCta() {
  return (
    <Section>
      <Reveal>
        <div
          className="mkt-aurora mkt-grain relative overflow-hidden rounded-[2rem] border px-6 py-20 text-center sm:px-10 sm:py-24"
          style={{ background: "var(--glass)", borderColor: "var(--glass-border)" }}
        >
          <div className="relative z-1 mx-auto flex max-w-2xl flex-col items-center">
            <h2
              className="text-balance text-3xl font-bold leading-[1.05] sm:text-4xl lg:text-5xl"
              style={{ color: "var(--t1)", letterSpacing: "-0.03em" }}
            >
              Ready to run your business in one place?
            </h2>
            <p className="mt-5 max-w-md text-base sm:text-lg" style={{ color: "var(--t2)" }}>
              Create your workspace in minutes. Free to start, with a 14-day trial of
              every feature.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
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
      </Reveal>
    </Section>
  );
}
