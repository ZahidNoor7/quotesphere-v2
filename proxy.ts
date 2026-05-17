import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use ONLY the edge-safe authConfig — no MongoDB, no crypto
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    // Exclude static files, NextAuth routes, and public webhook endpoints from auth checks
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/webhooks).*)",
  ],
};
