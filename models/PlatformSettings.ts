import mongoose, { Schema, Document, Model } from "mongoose";
import type { BillingCurrency } from "@/types";

/**
 * GLOBAL platform configuration — a single document keyed `"global"`. NOT
 * tenant-scoped. Holds owner-tunable defaults like the trial length and the
 * past-due grace window (a tenant may override grace on its own subscription).
 */
export interface IPlatformSettings extends Document {
  key: string;
  default_trial_days: number;
  default_grace_period_days: number;
  default_currency: BillingCurrency;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    default_trial_days: { type: Number, default: 14, min: 0 },
    default_grace_period_days: { type: Number, default: 7, min: 0 },
    default_currency: { type: String, enum: ["PKR", "USD"], default: "PKR" },
  },
  { timestamps: true, versionKey: false, collection: "platformsettings" },
);

const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ||
  mongoose.model<IPlatformSettings>("PlatformSettings", platformSettingsSchema);

/**
 * Fetch the singleton, creating it with defaults on first use. Atomic upsert so
 * concurrent callers can't create duplicates (the unique `key` also guards it).
 */
export async function getPlatformSettings(): Promise<IPlatformSettings> {
  const doc = await PlatformSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global" } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );
  return doc as IPlatformSettings;
}

export default PlatformSettings;
