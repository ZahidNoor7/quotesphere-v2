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
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    org_id?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    org_id?: string;
  }
}
