import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";

export type PayPeriodStatus = "open" | "processing" | "closed";

export interface IPayPeriod extends Document {
  org_id?: mongoose.Types.ObjectId;
  label: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  status: PayPeriodStatus;
  createdAt: Date;
  updatedAt: Date;
}

const payPeriodSchema = new Schema<IPayPeriod>(
  {
    label: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payDate: { type: Date, required: true },
    status: { type: String, enum: ["open", "processing", "closed"], default: "open" },
  },
  { timestamps: true, versionKey: false }
);

// One period per (startDate,endDate) per org — first line of defense against duplicates.
payPeriodSchema.index({ org_id: 1, startDate: 1, endDate: 1 }, { unique: true });
payPeriodSchema.index({ org_id: 1, status: 1, startDate: -1 });

payPeriodSchema.plugin(tenantScope);

const PayPeriod: Model<IPayPeriod> =
  mongoose.models.PayPeriod || mongoose.model<IPayPeriod>("PayPeriod", payPeriodSchema);

export default PayPeriod;
