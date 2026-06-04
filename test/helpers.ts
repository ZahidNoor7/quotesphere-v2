import { NextRequest } from "next/server";

/** Build a NextRequest the route handlers can consume. */
export function req(path: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Second arg for dynamic `[id]` route handlers (Next 15/16 passes params as a Promise). */
export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Override the mocked auth() session for the current test (RBAC / 401 cases).
 *  Injects the test org id onto any user that doesn't set one, so role checks
 *  (not the org gate) are what's exercised. */
export async function setSession(session: unknown) {
  const { auth } = await import("@/auth");
  let merged = session;
  if (session && typeof session === "object" && "user" in session && (session as { user?: unknown }).user) {
    const s = session as { user: Record<string, unknown> };
    if (s.user.org_id === undefined) merged = { ...s, user: { ...s.user, org_id: "0000000000000000000000ce" } };
  }
  (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(merged);
}

/** Create a customer directly; returns the fields docs need (id, name, phone). */
export async function makeCustomer(name = "Acme Co", phone = "923001234567") {
  const { POST } = await import("@/app/api/customers/route");
  const res = await POST(req("/api/customers", "POST", { name, phone_no: phone }));
  const json = await res.json();
  return { id: json.data._id as string, name, phone };
}
