import type { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";

/**
 * Payroll is admin-only on EVERY verb (salary data is sensitive). The admin-gated
 * operation in the RBAC matrix is `"settings"`, so we always check that op
 * regardless of HTTP method. Returns a 403 NextResponse when denied, else null.
 *
 *   const denied = requireAdmin(session); if (denied) return denied;
 */
export function requireAdmin(session: unknown): NextResponse | null {
  return requireRole(session, "GET", "settings");
}
