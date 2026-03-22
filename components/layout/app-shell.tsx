"use client";
import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Sidebar, MobileNav } from "./sidebar";
import { applyTheme } from "@/lib/themes";
import { useTheme } from "./theme-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings, updateAppearance } = useSettings();
  const { setTheme } = useTheme();
  const collapsed = settings?.appearance?.sidebarCollapsed ?? false;

  // Sync theme from DB when settings load (handles cross-device persistence)
  useEffect(() => {
    const themeId = settings?.appearance?.themeId;
    if (themeId) {
      setTheme(themeId);
      applyTheme(themeId);
    }
  }, [settings?.appearance?.themeId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="flex h-screen overflow-hidden relative app-bg"
      style={{ fontFamily: "var(--font-geist-sans, -apple-system, system-ui)" }}
    >
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0 relative z-10">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => updateAppearance({ sidebarCollapsed: !collapsed })}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Mobile top bar */}
        <MobileNav />

        {/* Main scroll area */}
        <main
          className="flex-1 overflow-y-auto scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
