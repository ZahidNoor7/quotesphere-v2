import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITemplateItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface ITemplate extends Document {
  name: string;
  type: "invoice" | "quotation" | "both";
  items: ITemplateItem[];
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  delivery_charges: number;
  currency: string;
  remarks?: string;
  payment_mode?: string;
  designId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ITemplateItem>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["invoice", "quotation", "both"], required: true, default: "both" },
    items: [itemSchema],
    tax: { type: Number, default: 0, min: 0 },
    tax_type: { type: String, enum: ["percentage", "value"], default: "percentage" },
    discount: { type: Number, default: 0, min: 0 },
    delivery_charges: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    remarks: String,
    payment_mode: String,
    designId: String,
  },
  { timestamps: true, versionKey: false }
);

templateSchema.index({ name: "text" });
templateSchema.index({ type: 1, createdAt: -1 });

const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>("Template", templateSchema);

export default Template;
