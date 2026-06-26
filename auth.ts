import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/db";
import { authConfig } from "./auth.config";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { ensureUserOrg } from "@/lib/provisioning";
import type { UserRole } from "@/types";

// A structurally-valid bcrypt hash that no password matches. Compared against it
// when an account isn't found so login does the same bcrypt work either way —
// no account enumeration and no timing oracle.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("unmatchable-placeholder-password", 12);

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
        // Always run a bcrypt compare (real hash or the dummy) and return ONE
        // generic error — no "account exists?" disclosure via message or timing.
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user?.password || DUMMY_PASSWORD_HASH,
        );
        if (!user || !isValid) throw new Error("Invalid email or password.");
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
        // Generic error + constant bcrypt work for unknown email AND bad password
        // — no account enumeration or timing oracle.
        const active = !!(admin && admin.is_active !== false && admin.password);
        const isValid = await bcrypt.compare(
          credentials.password as string,
          (active && admin?.password) || DUMMY_PASSWORD_HASH,
        );
        if (!active || !isValid) throw new Error("Invalid credentials.");
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
          token.checkedAt = Date.now();
        }
      } else if (!token.isPlatformAdmin && token.sub) {
        // Token refresh (no `user`): re-resolve role + org_id from the DB so a
        // role demotion, org change, or account deletion takes effect WITHOUT
        // waiting for the (long) token to expire. Throttled to ≤ once / 5 min so
        // this stays off the hot path.
        const last = typeof token.checkedAt === "number" ? token.checkedAt : 0;
        if (Date.now() - last > 5 * 60 * 1000) {
          try {
            const client = await clientPromise;
            let _id: ObjectId | null = null;
            try { _id = new ObjectId(token.sub); } catch { _id = null; }
            const dbUser = _id
              ? await client.db().collection("users").findOne({ _id }, { projection: { role: 1, org_id: 1 } })
              : null;
            if (dbUser) {
              token.role = (dbUser.role as UserRole) || "admin";
              if (dbUser.org_id) token.org_id = String(dbUser.org_id);
            } else {
              // User no longer exists → drop tenant claims so withTenant returns 401.
              token.role = undefined;
              token.org_id = undefined;
            }
          } catch {
            // DB hiccup → keep existing claims; we'll re-check on the next interval.
          }
          token.checkedAt = Date.now();
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
  // 7-day token lifetime (was the 30-day default) to bound the window of a stolen
  // JWT; role/org changes apply much sooner via the 5-min re-resolve in `jwt`.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
});
