"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section";
import { FAQ_ITEMS } from "@/lib/marketing/content";

export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />
      <div className="mx-auto mt-12 max-w-3xl">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={item.q}
              value={`item-${i}`}
              style={{ borderColor: "var(--glass-border)" }}
            >
              <AccordionTrigger
                className="text-left text-base hover:no-underline"
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
      </div>
    </Section>
  );
}
