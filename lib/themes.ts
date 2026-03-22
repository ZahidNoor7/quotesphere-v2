export const THEMES = [
  { id: "dark",      name: "Dark",         base: "dark",   accent: "#6366f1", accent2: "#818cf8", bg: "#0d1120" },
  { id: "light",     name: "Light",        base: "light",  accent: "#6366f1", accent2: "#4f46e5", bg: "#f8fafc" },
  { id: "system",    name: "System",       base: "system", accent: "#6366f1", accent2: "#818cf8", bg: "auto"    },
  { id: "midnight",  name: "Midnight Blue",base: "dark",   accent: "#3b82f6", accent2: "#60a5fa", bg: "#0a0f1e" },
  { id: "forest",    name: "Forest",       base: "dark",   accent: "#10b981", accent2: "#34d399", bg: "#0a1a12" },
  { id: "rose",      name: "Rose",         base: "dark",   accent: "#f43f5e", accent2: "#fb7185", bg: "#1a0a10" },
  { id: "slate",     name: "Slate Pro",    base: "dark",   accent: "#64748b", accent2: "#94a3b8", bg: "#0f172a" },
  { id: "amber",     name: "Amber",        base: "dark",   accent: "#f59e0b", accent2: "#fbbf24", bg: "#1a1200" },
  { id: "nord",      name: "Nord",         base: "dark",   accent: "#88c0d0", accent2: "#a3d4e0", bg: "#2e3440" },
  { id: "solarized", name: "Solarized",    base: "light",  accent: "#268bd2", accent2: "#2aa4f7", bg: "#fdf6e3" },
] as const;

export type ThemeId = typeof THEMES[number]["id"];
export type ThemeBase = "dark" | "light" | "system";

export interface Theme {
  id: ThemeId;
  name: string;
  base: ThemeBase;
  accent: string;
  accent2: string;
  bg: string;
}

export function getTheme(id: string): Theme {
  return (THEMES.find(t => t.id === id) ?? THEMES[0]) as Theme;
}

export function getResolvedBase(themeId: string): "dark" | "light" {
  const theme = getTheme(themeId);
  if (theme.base === "system") {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark"; // server-side default
  }
  return theme.base as "dark" | "light";
}

export function applyTheme(themeId: string): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-theme", themeId);
  const isDark = getResolvedBase(themeId) === "dark";
  html.classList.toggle("dark", isDark);
  html.classList.toggle("light", !isDark);
  // Persist in cookie so the server can read it on next request (flash-free SSR)
  document.cookie = `qs-theme=${themeId}; path=/; max-age=31536000; SameSite=Lax`;
}
