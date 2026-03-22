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

export default Counter;
