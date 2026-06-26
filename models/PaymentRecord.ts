import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import type { PaymentRecordStatus, BillingCurrency } from "@/types";

/**
 * A billing payment/charge record for a tenant's subscription — used for billing
 * history and manual "mark paid" now, automated reconciliation later. TENANT-SCOPED
 * so a tenant only ever sees its own records. `provider`/`provider_ref` are nullable
 * (manual entries) so a real gateway plugs in later with no schema churn.
 */
export interface IPaymentRecord extends Document {
  org_id: mongoose.Types.ObjectId;
  subscription_id?: mongoose.Types.ObjectId;
  amount: number;
  currency: BillingCurrency;
  status: PaymentRecordStatus;
  method: string;
  provider?: string | null;
  provider_ref?: string | null;
  description?: string;
  plan_slug?: string;
  recorded_by_type: "platform" | "system";
  recorded_by_id?: string;
  /** Caller-supplied dedupe token — makes manual "mark paid" double-submit-safe. */
  idempotency_key?: string | null;
  paid_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentRecordSchema = new Schema<IPaymentRecord>(
  {
    subscription_id: { type: Schema.Types.ObjectId, ref: "Subscription", index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["PKR", "USD"], required: true },
    status: {
      type: String,
      enum: ["paid", "pending", "failed", "refunded"],
      required: true,
      default: "paid",
      index: true,
    },
    method: { type: String, default: "manual" },
    provider: { type: String, default: null },
    provider_ref: { type: String, default: null },
    description: { type: String, default: "" },
    plan_slug: { type: String, default: "" },
    recorded_by_type: { type: String, enum: ["platform", "system"], default: "platform" },
    recorded_by_id: { type: String, default: "" },
    idempotency_key: { type: String, default: null },
    paid_at: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: "paymentrecords" },
);

paymentRecordSchema.index({ createdAt: -1 });
// Idempotency for future gateway webhooks: a (provider, provider_ref) pair is unique
// when a string provider_ref is present; manual records (null ref) are exempt.
paymentRecordSchema.index(
  { provider: 1, provider_ref: 1 },
  { unique: true, partialFilterExpression: { provider_ref: { $type: "string" } } },
);
// Manual "mark paid" idempotency: a given key records at most one payment, so a
// double-click / retried request can't create duplicate charges.
paymentRecordSchema.index(
  { org_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
);

paymentRecordSchema.plugin(tenantScope);

const PaymentRecord: Model<IPaymentRecord> =
  mongoose.models.PaymentRecord ||
  mongoose.model<IPaymentRecord>("PaymentRecord", paymentRecordSchema);

export default PaymentRecord;
