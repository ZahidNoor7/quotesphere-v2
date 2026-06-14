import mongoose, { Schema, Document, Model } from "mongoose";
import type { TenantInviteStatus } from "@/types";

/**
 * A platform-issued invite that pre-sets a trial length (and optionally a plan)
 * for a tenant who has NOT signed up yet. GLOBAL / NOT tenant-scoped — it exists
 * before any org. Consumed at signup by matching the registering email; on
 * consumption its overrides seed the new tenant's trial subscription.
 */
export interface ITenantInvite extends Document {
  email: string;
  token: string;
  trial_days_override?: number | null;
  plan_id_override?: mongoose.Types.ObjectId | null;
  status: TenantInviteStatus;
  created_by?: mongoose.Types.ObjectId;
  consumed_by_org_id?: mongoose.Types.ObjectId | null;
  consumed_at?: Date | null;
  expires_at?: Date | null;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const tenantInviteSchema = new Schema<ITenantInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    token: { type: String, required: true, unique: true },
    trial_days_override: { type: Number, default: null, min: 0 },
    plan_id_override: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    status: {
      type: String,
      enum: ["pending", "consumed", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    created_by: { type: Schema.Types.ObjectId, ref: "PlatformAdmin" },
    consumed_by_org_id: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    consumed_at: { type: Date, default: null },
    expires_at: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false, collection: "tenantinvites" },
);

const TenantInvite: Model<ITenantInvite> =
  mongoose.models.TenantInvite ||
  mongoose.model<ITenantInvite>("TenantInvite", tenantInviteSchema);

export default TenantInvite;
