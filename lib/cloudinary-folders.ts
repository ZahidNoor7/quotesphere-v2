/**
 * Single source of truth for where every feature stores its media in Cloudinary.
 *
 * All assets live under one parent (`Quotesphere`) and are grouped per feature and
 * then per record: `Quotesphere/<Feature>/<recordId>`. Features never hardcode a
 * folder string — they reference a key here and let `cloudinaryFolder()` build the
 * path, so the structure can't drift the way scattered string literals did.
 */

/** The single parent directory under which every Cloudinary asset is stored. */
export const CLOUDINARY_ROOT = "Quotesphere";

/**
 * One entry per feature that uploads to Cloudinary.
 *  - `dir`   — the second-level folder under the root.
 *  - `scope` — where the per-record subfolder segment comes from:
 *      - `"owner"`  → the authenticated user's id (server-derived; a client cannot
 *                     override it). Used for per-user assets and for uploads that
 *                     happen before a record exists (e.g. an expense bill scan).
 *      - `"record"` → an id supplied by the caller (a project, invoice, … id).
 */
export const CLOUDINARY_FEATURES = {
  avatars: { dir: "Avatars", scope: "owner" },
  logos: { dir: "Logos", scope: "owner" },
  assistant: { dir: "Assistant", scope: "owner" },
  expenses: { dir: "Expenses", scope: "owner" },
  projects: { dir: "Projects", scope: "record" },
  invoices: { dir: "Invoices", scope: "record" },
  quotations: { dir: "Quotations", scope: "record" },
  whatsapp: { dir: "WhatsApp", scope: "record" },
} as const satisfies Record<string, { dir: string; scope: "owner" | "record" }>;

export type CloudinaryFeature = keyof typeof CLOUDINARY_FEATURES;

/** Narrow an untrusted value (e.g. a form field) to a known feature key. */
export function isCloudinaryFeature(value: unknown): value is CloudinaryFeature {
  return typeof value === "string" && value in CLOUDINARY_FEATURES;
}

/**
 * Strip a record id down to characters safe for a folder segment so it can never
 * escape the parent or inject a path (no `/`, no `..`). Capped to keep public_ids
 * within Cloudinary's limits.
 */
export function sanitizeSegment(id?: string | null): string {
  return (id ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
}

/**
 * Build the fully-qualified Cloudinary folder for a feature:
 * `Quotesphere/<Feature>/<recordId>`. Falls back to `Quotesphere/<Feature>` when no
 * (usable) record id is given.
 */
export function cloudinaryFolder(feature: CloudinaryFeature, recordId?: string | null): string {
  const base = `${CLOUDINARY_ROOT}/${CLOUDINARY_FEATURES[feature].dir}`;
  const segment = sanitizeSegment(recordId);
  return segment ? `${base}/${segment}` : base;
}
