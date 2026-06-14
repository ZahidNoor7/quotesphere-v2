"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "@/hooks/use-settings";
import { useEntitlements } from "@/hooks/use-entitlements";
import { featureForRoute } from "@/lib/entitlements/features";
import { SubscriptionBanner } from "@/components/entitlements/subscription-banner";
import { FeatureLocked } from "@/components/entitlements/feature-locked";
import { Sidebar, MobileNav } from "./sidebar";
import { applyTheme } from "@/lib/themes";
import { useTheme } from "./theme-provider";

const SIDEBAR_COOKIE = "qs-sidebar-collapsed";

export function AppShell({
  children,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}) {
  const { settings, updateAppearance } = useSettings();
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const { entitlements } = useEntitlements();

  // Client-side feature gate: if the current module maps to a feature the tenant's
  // plan doesn't include, show the locked screen instead of the page. (The API is
  // the real boundary — this is the matching UX.)
  const routeFeature = featureForRoute(pathname);
  const lockedFeature =
    routeFeature && entitlements && !entitlements.features.includes(routeFeature)
      ? routeFeature
      : null;

  // Initialized from the cookie read server-side — correct on first render, no flash.
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Sync theme from DB when settings load (handles cross-device persistence)
  useEffect(() => {
    const themeId = settings?.appearance?.themeId;
    if (themeId) {
      setTheme(themeId);
      applyTheme(themeId);
    }
  }, [settings?.appearance?.themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // Persist in cookie so the server reads it on next request — eliminates refresh flicker.
    document.cookie = `${SIDEBAR_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    updateAppearance({ sidebarCollapsed: next });
  };

  return (
    <div
      className="flex overflow-hidden relative app-bg"
      // 100dvh (not h-screen/100vh) so the shell fills only the visible viewport on
      // mobile — keeps pinned headers/composers on-screen instead of below the fold.
      style={{ height: "100dvh", fontFamily: "var(--font-geist-sans, -apple-system, system-ui)" }}
    >
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0 relative z-10">
        <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Mobile top bar */}
        <MobileNav />

        {/* Persistent trial / past-due / canceled reminder (renders nothing when active) */}
        <SubscriptionBanner />

        {/* Main scroll area */}
        <main
          className="flex-1 overflow-hidden scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="animate-fade-in h-full">
            {lockedFeature ? <FeatureLocked feature={lockedFeature} /> : children}
          </div>
        </main>
      </div>
    </div>
  );
}
