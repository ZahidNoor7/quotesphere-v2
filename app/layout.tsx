import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SWRProvider } from "@/components/layout/swr-provider";
import { auth } from "@/auth";
import { getTheme } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QuoteSphere",
  description: "Professional invoice and quotation management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let initialThemeId = "dark";

  // 1. Cookie is the fastest source — set client-side by applyTheme() on every change.
  //    This guarantees correct SSR on refresh without any async DB call.
  try {
    const cookieStore = await cookies();
    const cookieTheme = cookieStore.get("qs-theme")?.value;
    if (cookieTheme) {
      initialThemeId = cookieTheme;
    }
  } catch { /* ignore */ }

  // 2. If no cookie (first visit, cleared cookies), fall back to DB.
  if (initialThemeId === "dark") {
    try {
      const session = await auth();
      if (session?.user) {
        const { connectDB } = await import("@/lib/mongoose");
        const { default: Settings } = await import("@/models/Settings");
        await connectDB();
        const settings = await Settings.findOne({
          user_id: (session.user as any).id,
        }).lean() as any;
        if (settings?.appearance?.themeId) {
          initialThemeId = settings.appearance.themeId;
        }
      }
    } catch { /* fall back to dark */ }
  }

  const theme = getTheme(initialThemeId);
  // system defaults to dark on server (can't read media query server-side)
  const isDark = theme.base === "dark" || theme.base === "system";

  return (
    <html
      lang="en"
      className={isDark ? "dark" : "light"}
      data-theme={initialThemeId}
      suppressHydrationWarning
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <SWRProvider>
            <ThemeProvider initialTheme={initialThemeId}>
              <Toaster
                theme={isDark ? "dark" : "light"}
                toastOptions={{
                  style: {
                    background: "var(--modal-bg)",
                    border: "0.5px solid var(--glass-border-strong)",
                    color: "var(--t1)",
                    borderRadius: 12,
                    backdropFilter: "blur(40px)",
                    fontSize: 13,
                  },
                }}
              />
              {children}
            </ThemeProvider>
          </SWRProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
