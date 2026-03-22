"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, getTheme } from "@/lib/themes";

interface ThemeContextValue {
  themeId: string;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: "dark",
  setTheme: () => {},
});

export function ThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: React.ReactNode;
  initialTheme?: string;
}) {
  const [themeId, setThemeId] = useState(initialTheme);

  // Apply theme to DOM on mount and when it changes
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Handle system theme OS preference changes
  useEffect(() => {
    if (themeId !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeId]);

  function setTheme(id: string) {
    setThemeId(id);
  }

  return (
    <ThemeContext.Provider value={{ themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { getTheme };
