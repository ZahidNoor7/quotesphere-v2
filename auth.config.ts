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
      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      const isPublicPath =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname.startsWith("/api/webhooks") ||
        nextUrl.pathname.startsWith("/print"); // token-gated print route (self-validates)

      // Logged in + trying to access auth pages → redirect to dashboard
      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Not logged in + trying to access protected pages → redirect to login
      if (!isLoggedIn && !isAuthPage && !isPublicPath) {
        return Response.redirect(new URL("/auth/login", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
  session: { strategy: "jwt" },
};
