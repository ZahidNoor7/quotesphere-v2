import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku?: string;
  description?: string;
  category: string;
  unit: string;
  default_price: number;
  currency: string;
  stock_qty: number;
  low_stock_threshold: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, sparse: true },
    description: String,
    category: { type: String, required: true, default: "General" },
    unit: { type: String, default: "pcs" },
    default_price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    stock_qty: { type: Number, default: 0, min: 0 },
    low_stock_threshold: { type: Number, default: 5, min: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

productSchema.index({ category: 1, is_active: 1 });
productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ name: "text", description: "text", sku: "text" });

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);

export default Product;
