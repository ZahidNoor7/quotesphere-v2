"use client";
import { useSession } from "next-auth/react";
import type { UserRole } from "@/types";

/** Current tenant user's role (client-side, for UI gating only — the API is the
 *  real authorization boundary). */
export function useRole(): UserRole | undefined {
  const { data } = useSession();
  return data?.user?.role as UserRole | undefined;
}

/** True when the signed-in user is an org admin. UI convenience only. */
export function useIsAdmin(): boolean {
  return useRole() === "admin";
}
