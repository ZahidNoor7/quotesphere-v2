import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed token that gates the public `/print/*` route.
 *
 * The PDF API route (which runs full `auth()` + RBAC) is the ONLY minter; the
 * print page verifies before rendering. The token is scoped to a single
 * {type,id} and carries the requesting user's id (so the token-only print page —
 * which has no session — can load that user's company settings + custom designs).
 * It expires fast, so even though `/print` is excluded from the auth middleware
 * (so headless Chrome can reach it), it is not browsable.
 */
const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
const TTL_MS = 60_000; // 60s — only needs to survive API route → Chromium → print page

export type PrintDocType = "invoice" | "quotation" | "payslip";

interface Payload {
  type: PrintDocType;
  id: string;
  uid: string; // requesting user's id → whose Settings/branding to render
  org: string; // requesting user's org → tenant scope for the print render
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function mintPrintToken(type: PrintDocType, id: string, uid: string, org: string): string {
  const body = Buffer.from(
    JSON.stringify({ type, id, uid, org, exp: Date.now() + TTL_MS } satisfies Payload),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the verified payload (incl. `uid`, `org`) or `null` if invalid/expired/tampered. */
export function verifyPrintToken(
  token: string | undefined,
  type: string,
  id: string,
): { uid: string; org: string } | null {
  if (!SECRET || !token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (p.type !== type || p.id !== id || p.exp <= Date.now()) return null;
    return { uid: p.uid, org: p.org };
  } catch {
    return null;
  }
}
