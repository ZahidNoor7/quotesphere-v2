import { z } from "zod";

/** ~50KB serialized cap per rich-text field — bounds payload/DB size per document. */
const MAX_SERIALIZED = 50_000;

/**
 * Accepts canonical ProseMirror JSON (an object) OR a legacy plain string.
 * Used by the create/update API routes for `remarks` and line-item `description`.
 * The renderer + sanitizer are the real safety net; this only validates shape/size.
 */
export const richTextZod = z
  .union([z.string().max(MAX_SERIALIZED), z.record(z.string(), z.unknown())])
  .refine(
    (v) => (typeof v === "string" ? true : JSON.stringify(v).length <= MAX_SERIALIZED),
    { message: "Rich text content is too large" },
  );

/** Optional + nullable variant for request bodies (empty fields may send null). */
export const richTextZodNullish = richTextZod.nullish();

/**
 * Validate the rich-text fields on a loosely-parsed update payload (the PUT
 * routes use a permissive record schema). Returns an error message, or null.
 */
export function validateRichTextFields(data: Record<string, unknown>): string | null {
  if (data.remarks != null && !richTextZod.safeParse(data.remarks).success) {
    return "Invalid remarks content";
  }
  if (Array.isArray(data.items)) {
    for (const it of data.items) {
      const desc = (it as Record<string, unknown> | null)?.description;
      if (desc != null && !richTextZod.safeParse(desc).success) {
        return "Invalid line-item description content";
      }
    }
  }
  return null;
}
