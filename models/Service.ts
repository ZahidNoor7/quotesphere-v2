import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";

export interface IService extends Document {
  name: string;
  description?: string;
  category: string;
  default_price: number;
  currency: string;
  unit?: string;
  is_active: boolean;
  org_id?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, required: true, default: "General" },
    default_price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    unit: { type: String, default: "job" },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

serviceSchema.index({ category: 1, is_active: 1 });
serviceSchema.index({ name: "text", description: "text" });

serviceSchema.plugin(tenantScope);

const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>("Service", serviceSchema);

export default Service;
