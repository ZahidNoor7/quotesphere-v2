import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";

export interface ICustomer extends Document {
  name: string;
  phone_no: string;
  address?: string;
  email?: string;
  company?: string;
  tax_id?: string;
  notes?: string;
  status: boolean;
  currency: string;
  org_id?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone_no: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    company: { type: String, trim: true },
    tax_id: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: Boolean, default: true },
    currency: { type: String, default: "PKR" },
  },
  { timestamps: true, versionKey: false }
);

customerSchema.index({ name: "text", company: "text", email: "text" });
customerSchema.index({ org_id: 1, status: 1, createdAt: -1 });
customerSchema.index({ org_id: 1, phone_no: 1 });

customerSchema.plugin(tenantScope);

const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
