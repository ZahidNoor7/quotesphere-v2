import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import type { SubscriptionStatus, BillingInterval, BillingCurrency } from "@/types";

/**
 * A Subscription is the tenant's billing/access record. It is TENANT-SCOPED with
 * `unique: true` → exactly one per org. Tenant reads (billing page, entitlements
 * resolver) auto-isolate via the plugin; platform writes target one org through
 * `runWithOrg(targetOrgId, …)` so a wrong id fails closed instead of leaking.
 *
 * `plan_snapshot` is FROZEN at purchase/assignment (same principle as payslip
 * snapshots) so later edits to the Plan catalog never retroactively change an
 * existing subscription's price or feature set.
 */
interface IPlanSnapshot {
  plan_id?: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  billing_interval: BillingInterval;
  price_pkr: number;
  price_usd: number;
  currency: BillingCurrency;
  features: string[];
}

export interface ISubscription extends Document {
  org_id: mongoose.Types.ObjectId;
  plan_id?: mongoose.Types.ObjectId;
  status: SubscriptionStatus;
  plan_snapshot: IPlanSnapshot;
  current_period_start?: Date | null;
  current_period_end?: Date | null;
  trial_ends_at?: Date | null;
  grace_period_days_override?: number | null;
  grace_ends_at?: Date | null;
  canceled_at?: Date | null;
  cancel_at_period_end: boolean;
  suspended_at?: Date | null;
  suspended_reason?: string;
  prev_status?: SubscriptionStatus | null;
  // A tenant-requested plan change awaiting platform-owner approval (manual billing).
  pending_change?: {
    plan_id?: mongoose.Types.ObjectId;
    plan_name: string;
    billing_interval: BillingInterval;
    direction: "upgrade" | "downgrade" | "change";
    note?: string;
    requested_by_user_id?: string;
    requested_at?: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const planSnapshotSchema = new Schema(
  {
    plan_id: { type: Schema.Types.ObjectId, ref: "Plan" },
    name: { type: String, default: "" },
    slug: { type: String, default: "" },
    billing_interval: {
      type: String,
      enum: ["monthly", "annual", "lifetime"],
      default: "monthly",
    },
    price_pkr: { type: Number, default: 0 },
    price_usd: { type: Number, default: 0 },
    currency: { type: String, enum: ["PKR", "USD"], default: "PKR" },
    features: { type: [String], default: [] },
  },
  { _id: false },
);

const pendingChangeSchema = new Schema(
  {
    plan_id: { type: Schema.Types.ObjectId, ref: "Plan" },
    plan_name: { type: String, default: "" },
    billing_interval: { type: String, enum: ["monthly", "annual", "lifetime"], default: "monthly" },
    direction: { type: String, enum: ["upgrade", "downgrade", "change"], default: "change" },
    note: { type: String, default: "" },
    requested_by_user_id: { type: String, default: "" },
    requested_at: { type: Date },
  },
  { _id: false },
);

const subscriptionSchema = new Schema<ISubscription>(
  {
    plan_id: { type: Schema.Types.ObjectId, ref: "Plan" },
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "canceled", "expired", "suspended"],
      required: true,
      default: "trialing",
      index: true,
    },
    plan_snapshot: { type: planSnapshotSchema, default: () => ({}) },
    current_period_start: { type: Date, default: null },
    current_period_end: { type: Date, default: null },
    trial_ends_at: { type: Date, default: null },
    grace_period_days_override: { type: Number, default: null, min: 0 },
    grace_ends_at: { type: Date, default: null },
    canceled_at: { type: Date, default: null },
    cancel_at_period_end: { type: Boolean, default: false },
    suspended_at: { type: Date, default: null },
    suspended_reason: { type: String, default: "" },
    prev_status: {
      type: String,
      enum: ["trialing", "active", "past_due", "canceled", "expired", "suspended"],
      default: null,
    },
    pending_change: { type: pendingChangeSchema, default: null },
  },
  { timestamps: true, versionKey: false, collection: "subscriptions" },
);

// Cron + reporting hot paths.
subscriptionSchema.index({ trial_ends_at: 1 });
subscriptionSchema.index({ current_period_end: 1 });
subscriptionSchema.index({ grace_ends_at: 1 });

// Tenant-scoped, one subscription per org (unique org_id).
subscriptionSchema.plugin(tenantScope, { unique: true });

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", subscriptionSchema);

export default Subscription;
