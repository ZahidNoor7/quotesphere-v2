import type { NextAuthConfig } from "next-auth";

// This is a MINIMAL auth config that is safe for the Edge runtime.
// It has NO imports of MongoDB, bcrypt, or any Node.js-only modules.
// Used ONLY in middleware.ts for session checking.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [],  // providers run on Node.js only - not needed in edge middleware
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPlatformAdmin = !!(auth?.user as { isPlatformAdmin?: boolean } | undefined)?.isPlatformAdmin;
      const path = nextUrl.pathname;
      const isAuthPage = path.startsWith("/auth");
      const isPlatformLogin = path === "/platform/login";
      const isPlatformPath = path.startsWith("/platform"); // portal pages (not /api/platform)
      const isPublicPath =
        path === "/" || // public marketing landing page
        path.startsWith("/_next") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/webhooks") ||
        path.startsWith("/print") || // token-gated print route (self-validates)
        // Public SEO + brand-asset endpoints for the marketing page — crawlers and
        // social scrapers hit these unauthenticated. Additive only: this widens
        // access to crawler/asset routes and never relaxes any app/API/platform path.
        path === "/robots.txt" ||
        path === "/sitemap.xml" ||
        path === "/manifest.webmanifest" ||
        path.startsWith("/opengraph-image") ||
        path.startsWith("/twitter-image") ||
        path.startsWith("/icon") ||
        path.startsWith("/apple-icon");

      if (isLoggedIn) {
        if (isPlatformAdmin) {
          // Platform admins live in the portal — keep them off tenant auth/dashboard.
          if (isAuthPage || isPlatformLogin) {
            return Response.redirect(new URL("/platform", nextUrl));
          }
          return true;
        }
        // Tenant users: bounce away from any login page. /platform/* is guarded
        // server-side by the (portal) layout, so let it through to be redirected there.
        if (isAuthPage || isPlatformLogin) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Not logged in
      if (isPlatformPath && !isPlatformLogin) {
        return Response.redirect(new URL("/platform/login", nextUrl));
      }
      if (!isAuthPage && !isPlatformLogin && !isPublicPath) {
        return Response.redirect(new URL("/auth/login", nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        // Surface the platform claim to the edge `authorized` callback for routing.
        (session.user as any).isPlatformAdmin = (token as any).isPlatformAdmin;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
