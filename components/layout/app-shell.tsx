"use client";
import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/use-settings";
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

        {/* Main scroll area */}
        <main
          className="flex-1 overflow-hidden scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="animate-fade-in h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
