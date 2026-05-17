/**
 * Pure client-safe audit utilities — no server imports.
 * Import from here in client components; import from lib/audit.ts only in API routes.
 */

export function diffSnapshots(
  before: Record<string, unknown> | null,
  after:  Record<string, unknown> | null
): Record<string, { before: unknown; after: unknown }> {
  if (!before || !after) return {};
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of allKeys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      diff[k] = { before: before[k], after: after[k] };
    }
  }
  return diff;
}
