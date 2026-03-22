import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use ONLY the edge-safe authConfig — no MongoDB, no crypto
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
