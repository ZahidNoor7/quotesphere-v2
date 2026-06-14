import mongoose, { Schema, Document, Model } from "mongoose";
import type { BillingInterval } from "@/types";

/**
 * A Plan is a GLOBAL catalog entry (NOT tenant-scoped) — the platform owner
 * defines plans once and every tenant reads the same catalog to see upgrade
 * options. Each plan grants an arbitrary set of feature keys (see
 * lib/entitlements/features.ts) and is priced in both PKR and USD. Lifetime
 * plans have no recurring period.
 */
export interface IPlan extends Document {
  name: string;
  slug: string;
  description?: string;
  billing_interval: BillingInterval;
  price_pkr: number;
  price_usd: number;
  features: string[];
  limits?: { maxTeamMembers?: number };
  is_active: boolean;
  is_grandfather: boolean;
  sort_order: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    billing_interval: {
      type: String,
      enum: ["monthly", "annual", "lifetime"],
      required: true,
      default: "monthly",
    },
    price_pkr: { type: Number, default: 0, min: 0 },
    price_usd: { type: Number, default: 0, min: 0 },
    features: { type: [String], default: [] },
    limits: { type: { maxTeamMembers: Number }, default: {} },
    is_active: { type: Boolean, default: true },
    // Internal plan used to grandfather pre-billing tenants; hidden from the public catalog.
    is_grandfather: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
  },
  // Collection name pinned explicitly so one-off migration scripts (raw driver)
  // and the app always agree on the target collection.
  { timestamps: true, versionKey: false, collection: "plans" },
);

planSchema.index({ is_active: 1, sort_order: 1 });

const Plan: Model<IPlan> =
  mongoose.models.Plan || mongoose.model<IPlan>("Plan", planSchema);

export default Plan;
