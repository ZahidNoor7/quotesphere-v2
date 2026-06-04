import { NextResponse } from "next/server";
import type { UserRole } from "@/types";

// ─── Permission matrix ────────────────────────────────────────────────────────
// Each role lists the operations it may perform.
// "viewer"  → read only
// "staff"   → read + create
// "manager" → read + create + update + delete
// "admin"   → full access including delete and settings (company config + team)

type Operation = "read" | "create" | "update" | "delete" | "settings";

const ROLE_PERMISSIONS: Record<UserRole, Set<Operation>> = {
  viewer:  new Set(["read"]),
  staff:   new Set(["read", "create"]),
  manager: new Set(["read", "create", "update", "delete"]),
  admin:   new Set(["read", "create", "update", "delete", "settings"]),
};

export function can(role: UserRole | undefined, op: Operation): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(op) ?? false;
}

// ─── HTTP method → operation mapping ─────────────────────────────────────────
function methodToOp(method: string): Operation {
  switch (method.toUpperCase()) {
    case "GET":    return "read";
    case "POST":   return "create";
    case "PUT":
    case "PATCH":  return "update";
    case "DELETE": return "delete";
    default:       return "read";
  }
}

// ─── Guard helper for API routes ──────────────────────────────────────────────
/**
 * Returns a 403 response if the session's role cannot perform the operation
 * derived from the HTTP method, or null if access is allowed.
 *
 * Usage in route handlers:
 *   const denied = requireRole(session, req.method);
 *   if (denied) return denied;
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireRole(
  session: any,
  method: string,
  override?: Operation
): NextResponse | null {
  const role = session?.user?.role as UserRole | undefined;
  const op = override ?? methodToOp(method);
  if (!can(role, op)) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }
  return null;
}
