import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/db";
import { authConfig } from "./auth.config";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { ensureUserOrg } from "@/lib/provisioning";
import type { UserRole } from "@/types";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(clientPromise as any),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // 10 login attempts per IP per 15 minutes
        const ip = getClientIP(request as Request);
        const rl = await rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        if (!credentials?.email || !credentials?.password) return null;
        const client = await clientPromise;
        const db = client.db();
        const user = await db.collection("users").findOne({
          email: (credentials.email as string).toLowerCase(),
        });
        if (!user) throw new Error("No account found with this email.");
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) throw new Error("Incorrect password.");
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role || "admin",
          org_id: user.org_id ? String(user.org_id) : undefined,
        };
      },
    }),
    // Platform super-admin login — a SEPARATE provider against the PlatformAdmin
    // collection. Tenant users (the providers above) can never produce the
    // `isPlatformAdmin` claim, and this provider never issues an org_id.
    Credentials({
      id: "platform-credentials",
      name: "Platform Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // 10 attempts per IP per 15 minutes (separate bucket from tenant login).
        const ip = getClientIP(request as Request);
        const rl = await rateLimit(`platform-login:${ip}`, 10, 15 * 60 * 1000);
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }
        if (!credentials?.email || !credentials?.password) return null;
        const client = await clientPromise;
        const db = client.db();
        const admin = await db.collection("platformadmins").findOne({
          email: (credentials.email as string).toLowerCase(),
        });
        // Generic error for unknown email AND bad password — no account enumeration.
        if (!admin || admin.is_active === false || !admin.password) {
          throw new Error("Invalid credentials.");
        }
        const isValid = await bcrypt.compare(credentials.password as string, admin.password);
        if (!isValid) throw new Error("Invalid credentials.");
        // Best-effort last-login stamp; never block sign-in on it.
        void db
          .collection("platformadmins")
          .updateOne({ _id: admin._id }, { $set: { last_login_at: new Date() } })
          .catch(() => {});
        return {
          id: admin._id.toString(),
          email: admin.email,
          name: admin.name || "Platform Admin",
          isPlatformAdmin: true,
          platformAdminId: admin._id.toString(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Persist the user's DB id in the token so session can read it
        if (user.id) token.sub = user.id;
        if ((user as { isPlatformAdmin?: boolean }).isPlatformAdmin) {
          // Platform super-admin — carry the platform claim and DELIBERATELY no
          // tenant role/org_id, so this principal can never act as a tenant.
          token.isPlatformAdmin = true;
          token.platformAdminId =
            (user as { platformAdminId?: string }).platformAdminId ?? user.id;
          token.role = undefined;
          token.org_id = undefined;
        } else {
          token.role = (user as { role?: UserRole }).role;
          // Resolve the org id once at sign-in. Credentials users already have one
          // (set at register); OAuth users (created by the adapter) are bootstrapped
          // an org on first login. Persisted in the token, so no per-request lookup.
          let orgId = (user as { org_id?: string }).org_id;
          if (!orgId && user.id) orgId = await ensureUserOrg(user.id, user.name);
          token.org_id = orgId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (token.isPlatformAdmin) {
          session.user.isPlatformAdmin = true;
          session.user.platformAdminId = token.platformAdminId as string | undefined;
        } else {
          session.user.role = token.role as UserRole | undefined;
          session.user.org_id = token.org_id as string | undefined;
        }
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
});
