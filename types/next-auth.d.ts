import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types";

// Augment Auth.js types so `session.user.id`, `.role`, and `.org_id` are typed
// everywhere instead of being cast through `any`.
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: UserRole;
      org_id?: string;
      // Platform super-admin — a DISTINCT principal (separate PlatformAdmin
      // collection). A tenant user never carries these; a platform admin never
      // carries role/org_id.
      isPlatformAdmin?: boolean;
      platformAdminId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    org_id?: string;
    isPlatformAdmin?: boolean;
    platformAdminId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    org_id?: string;
    isPlatformAdmin?: boolean;
    platformAdminId?: string;
    /** Epoch ms of the last DB re-resolve of role/org_id (throttles the refresh check). */
    checkedAt?: number;
  }
}
