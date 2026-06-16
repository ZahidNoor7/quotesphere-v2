import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/footer";

// PUBLIC route group — intentionally NO auth()/redirect here so the landing page
// renders for logged-out visitors. It nests under the root layout (which already
// provides SessionProvider + ThemeProvider), so the page is theme-aware and the
// nav can read the session client-side. Tenant context is never entered.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // The root <body> is `position: fixed; height: 100dvh` (it lets the app shell
  // own its scroll), so a long page can't rely on the body to scroll. Mirror the
  // shell: make this wrapper its OWN 100dvh scroll region. The sticky nav sticks
  // to this container, and anchor scrollIntoView targets it.
  return (
    <div
      className="h-dvh overflow-y-auto"
      style={{ background: "var(--bg-primary)", color: "var(--t1)" }}
    >
      <div className="flex min-h-full flex-col">
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}
