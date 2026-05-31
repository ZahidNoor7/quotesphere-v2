import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use ONLY the edge-safe authConfig — no MongoDB, no crypto
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    // Exclude static files, NextAuth routes, public webhook endpoints, and the
    // token-gated /print route (reached by headless Chrome, self-validates) from auth checks
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/webhooks|print).*)",
  ],
};
