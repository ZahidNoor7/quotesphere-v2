/**
 * Secret handling for tenant Settings. Integration credentials (provider API
 * keys, SMTP password) are WRITE-ONLY: never returned to the client in plaintext,
 * and a blank/masked submit must not clobber the stored value.
 *
 *   - GET  → run the settings doc through `maskSecrets` so responses carry the
 *            `SECRET_MASK` sentinel (when a secret is set) instead of the real key.
 *   - PUT  → drop any `$set` path whose leaf is a secret and whose value is the
 *            sentinel/empty (the client echoed the mask = "unchanged").
 */

/** Shown to the client when a secret IS configured; never the real value. */
export const SECRET_MASK = "••••••••";

/** Leaf field names that hold credentials. Compared case-insensitively. */
const SECRET_LEAF_KEYS = new Set([
  "apikey",
  "apisecret",
  "smtppassword",
  "password",
  "secret",
  "clientsecret",
  "token",
]);

export function isSecretLeaf(key: string): boolean {
  return SECRET_LEAF_KEYS.has(key.toLowerCase());
}

/** Deep-clone `value`, replacing every secret leaf with the mask sentinel (set) or "" (unset). */
export function maskSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => maskSecrets(v)) as unknown as T;
  // Recurse ONLY into PLAIN objects — leave Date / ObjectId / Buffer / other class
  // instances intact (recursing into an ObjectId would mangle `_id`/`org_id`).
  if (
    value &&
    typeof value === "object" &&
    (value as { constructor?: unknown }).constructor === Object
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretLeaf(k) ? (v ? SECRET_MASK : "") : maskSecrets(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** True when a submitted secret is the mask/empty (i.e. the caller did not change it). */
export function isUnchangedSecret(v: unknown): boolean {
  return v == null || v === "" || v === SECRET_MASK;
}

/** Resolve a possibly-masked secret the client submitted against its stored value. */
export function resolveSubmittedSecret(submitted: unknown, stored: string | undefined): string | undefined {
  return isUnchangedSecret(submitted) ? stored : String(submitted);
}
