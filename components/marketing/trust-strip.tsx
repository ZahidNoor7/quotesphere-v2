import { Check } from "lucide-react";
import { TRUST_ITEMS } from "@/lib/marketing/content";
import { Reveal } from "./motion";

export function TrustStrip() {
  return (
    <div
      className="border-y"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
    >
      <Reveal className="mx-auto flex w-full max-w-6xl flex-col items-center gap-7 px-5 py-9 sm:px-6 lg:px-8">
        <p
          className="flex items-center gap-2 text-center text-sm"
          style={{ color: "var(--t2)" }}
        >
          <Check className="size-4 shrink-0" style={{ color: "var(--accent2)" }} aria-hidden />
          Free 14-day trial of every feature. No credit card required.
        </p>

        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2.5">
              <Icon
                className="size-5 shrink-0"
                style={{ color: "var(--accent2)" }}
                aria-hidden
              />
              <span
                className="text-sm font-medium leading-tight"
                style={{ color: "var(--t2)" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
