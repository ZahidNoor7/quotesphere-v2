import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document {
  name: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", counterSchema);

export async function getNextNumber(
  name: string,
  prefix: string,
  digits = 5
): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
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
  name: string,
  prefix: string,
  pattern?: string | null
): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
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
