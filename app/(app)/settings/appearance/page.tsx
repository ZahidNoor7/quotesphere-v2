"use client";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/layout/theme-provider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function AppearanceSettingsPage() {
  const { settings, updateAppearance } = useSettings();
  const { themeId: currentThemeId, setTheme } = useTheme();

  const secTitle = { fontSize: 14, fontWeight: 500, color: T1, marginBottom: 16 } as const;
  const sidebarCollapsed = settings?.appearance?.sidebarCollapsed ?? false;

  return (
    <>
      <div style={secTitle}>App appearance</div>
      <div style={{ fontSize: 12, color: T3, marginBottom: 20 }}>
        Choose a theme. Changes apply instantly and sync across all your devices.
      </div>

      <div style={{ fontSize: 12, color: T2, fontWeight: 500, marginBottom: 10 }}>Theme</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        {THEMES.map((theme: any) => {
          const activeId = settings?.appearance?.themeId ?? currentThemeId ?? "dark";
          const isActive = activeId === theme.id;
          const isDark = theme.base !== "light";
          return (
            <div
              key={theme.id}
              onClick={() => { setTheme(theme.id); updateAppearance({ themeId: theme.id }); }}
              style={{
                borderRadius: 10,
                border: `1.5px solid ${isActive ? theme.accent : GLASS_BORDER}`,
                overflow: "hidden",
                cursor: "pointer",
                boxShadow: isActive ? `0 0 0 1px ${theme.accent}40` : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
                position: "relative",
              }}
            >
              <div style={{ height: 64, display: "flex", background: theme.bg === "auto" ? "#0d1120" : theme.bg }}>
                <div style={{
                  width: 30,
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  display: "flex", flexDirection: "column", gap: 4, padding: "8px 6px",
                  borderRight: `0.5px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, background: theme.accent, marginBottom: 4 }} />
                  <div style={{ height: 3, background: theme.accent, borderRadius: 2, opacity: 0.9 }} />
                  {[80, 65, 75].map(w => (
                    <div key={w} style={{ height: 3, background: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)", borderRadius: 2, width: `${w}%` }} />
                  ))}
                </div>
                <div style={{ flex: 1, padding: "7px 9px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ height: 4, background: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)", borderRadius: 2, width: "45%" }} />
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1].map(i => (
                      <div key={i} style={{ height: 16, flex: 1, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", borderRadius: 5, border: `0.5px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)"}` }} />
                    ))}
                  </div>
                  <div style={{ height: 9, background: theme.accent, borderRadius: 100, width: 38, opacity: 0.9 }} />
                </div>
              </div>
              <div style={{
                padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: isDark ? T1 : "#0f172a" }}>{theme.name}</span>
                {isActive && (
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M2 5l2 2.5L8 3" /></svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: T2, fontWeight: 500, marginBottom: 8 }}>Default sidebar state</div>
      <RadioGroup
        value={sidebarCollapsed ? "collapsed" : "expanded"}
        onValueChange={v => updateAppearance({ sidebarCollapsed: v === "collapsed" })}
        className="gap-1.5"
      >
        {([["expanded", "Show labels by default"], ["collapsed", "Icon-only, more screen space"]] as const).map(([v, l]) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS, cursor: "pointer" }}>
            <RadioGroupItem value={v} />
            <span style={{ fontSize: 12, color: T2 }}>{l}</span>
          </label>
        ))}
      </RadioGroup>
    </>
  );
}
