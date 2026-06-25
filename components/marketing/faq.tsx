"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section";
import { Reveal } from "./motion";
import { FAQ_ITEMS, SUPPORT_EMAIL } from "@/lib/marketing/content";

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* LEFT — heading + contact */}
        <div className="self-start lg:sticky lg:top-28">
          <SectionHeading
            align="left"
            title="Questions, answered"
            subtitle="Getting started, pricing, data isolation and currencies, in plain terms."
          />
          <Reveal className="mt-6 text-sm">
            <span style={{ color: "var(--t2)" }}>Still unsure? </span>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="rounded font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
              style={{ color: "var(--accent-ink)" }}
            >
              {SUPPORT_EMAIL}
            </a>
          </Reveal>
        </div>

        {/* RIGHT — accordion */}
        <Reveal>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`item-${i}`}
                className="border-(--glass-border)"
              >
                <AccordionTrigger
                  className="py-5 text-left text-base hover:no-underline"
                  style={{ color: "var(--t1)" }}
                >
                  {item.q}
                </AccordionTrigger>
                <AccordionContent
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--t2)" }}
                >
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </Section>
  );
}
