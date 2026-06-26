import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document {
  org_id: mongoose.Types.ObjectId;
  name: string;
  seq: number;
}

// Counters are per-organization so each org has its own document numbering
// sequence. Counter is intentionally NOT tenant-plugin'd: it is keyed by an
// explicit org id passed by the caller, so it works in any context.
const counterSchema = new Schema<ICounter>({
  org_id: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  name: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
counterSchema.index({ org_id: 1, name: 1 }, { unique: true });

const Counter =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", counterSchema);

export async function getNextNumber(
  orgId: string,
  name: string,
  prefix: string,
  digits = 5
): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { org_id: orgId, name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(digits, "0")}`;
}

/**
 * Generate a document number using a user-defined pattern.
 *
 * Supported tokens:
 *   {prefix}    → the document prefix (e.g. "INV")
 *   {YYYY}      → 4-digit year (e.g. "2026")
 *   {YY}        → 2-digit year (e.g. "26")
 *   {MM}        → zero-padded month (e.g. "05")
 *   {seq:N}     → sequence number zero-padded to N digits (e.g. {seq:5} → "00001")
 *
 * Default pattern (when none configured): "{prefix}-{seq:5}"
 */
export async function getNextNumberWithPattern(
  orgId: string,
  name: string,
  prefix: string,
  pattern?: string | null
): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { org_id: orgId, name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );

  const resolvedPattern = pattern?.trim() || "{prefix}-{seq:5}";
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const yy   = yyyy.slice(-2);
  const mm   = String(now.getMonth() + 1).padStart(2, "0");

  return resolvedPattern
    .replace("{prefix}", prefix)
    .replace("{YYYY}",   yyyy)
    .replace("{YY}",     yy)
    .replace("{MM}",     mm)
    .replace(/\{seq:(\d+)\}/g, (_, n) => String(counter.seq).padStart(Number(n), "0"))
    .replace("{seq}",    String(counter.seq).padStart(5, "0")); // bare {seq} fallback
}

export default Counter;
