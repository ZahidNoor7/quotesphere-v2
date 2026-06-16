import { TRUST_ITEMS } from "@/lib/marketing/content";

export function TrustStrip() {
  return (
    <div
      className="border-y"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-4 px-5 py-7 sm:px-6 lg:grid-cols-4 lg:px-8">
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5">
            <Icon className="size-5 shrink-0" style={{ color: "var(--accent2)" }} aria-hidden />
            <span className="text-sm font-medium" style={{ color: "var(--t2)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
