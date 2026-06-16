import Link from "next/link";
import { Logo } from "./logo";
import { NAV_LINKS, SUPPORT_EMAIL } from "@/lib/marketing/content";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Logo />
            <p className="text-sm leading-relaxed" style={{ color: "var(--t3)" }}>
              Quoting, invoicing, projects and payroll for modern businesses — in PKR and USD.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--t3)" }}
            >
              Product
            </span>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm" style={{ color: "var(--t2)" }}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--t3)" }}
            >
              Get started
            </span>
            <Link href="/auth/register" className="text-sm" style={{ color: "var(--t2)" }}>
              Start free trial
            </Link>
            <Link href="/auth/login" className="text-sm" style={{ color: "var(--t2)" }}>
              Sign in
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm" style={{ color: "var(--t2)" }}>
              Contact
            </a>
          </div>
        </div>

        <div
          className="mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <span className="text-xs" style={{ color: "var(--t3)" }}>
            © {year} QuoteSphere. All rights reserved.
          </span>
          {/* Privacy / Terms pages don't exist yet — shown as placeholders, not invented legal copy. */}
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: "var(--t3)" }}>
              Privacy (coming soon)
            </span>
            <span className="text-xs" style={{ color: "var(--t3)" }}>
              Terms (coming soon)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
