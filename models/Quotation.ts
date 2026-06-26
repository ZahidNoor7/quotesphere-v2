import mongoose, { Schema, Document, Model } from "mongoose";
import { getNextNumber } from "./Counter";
import { tenantScope } from "@/lib/tenant-plugin";
import type { RichTextContent } from "@/types";

export interface IQuotationItem {
  id: number;
  name: string;
  /** Optional rich-text details (ProseMirror JSON; legacy records hold a string). */
  description?: RichTextContent;
  quantity: number;
  price: number;
  images?: string[];
}

export interface IQuotation extends Document {
  quotation_no: string;
  issue_date: Date;
  valid_until?: Date;
  status: "draft" | "pending" | "approved" | "rejected" | "cancelled" | "invoiced" | "expired";
  items: IQuotationItem[];
  sub_total: number;
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  delivery_charges: number;
  total_amount: number;
  currency: string;
  remarks?: RichTextContent;
  // Relations
  customer_id: mongoose.Types.ObjectId;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  project_id?: mongoose.Types.ObjectId;
  // Conversion
  converted_to?: mongoose.Types.ObjectId;
  approved_at?: Date;
  // Document design
  designId?: string;
  // Exchange rates at time of creation
  rateSnapshot?: Record<string, number>;
  org_id?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IQuotationItem>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    images: [String],
    // Rich-text line-item details (ProseMirror JSON; optional, additive).
    description: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const quotationSchema = new Schema<IQuotation>(
  {
    quotation_no: { type: String, index: true },
    issue_date: { type: Date, required: true },
    valid_until: Date,
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "cancelled", "invoiced", "expired"],
      default: "pending",
    },
    items: [itemSchema],
    sub_total: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0 },
    tax_type: { type: String, enum: ["percentage", "value"], default: "percentage" },
    discount: { type: Number, default: 0 },
    delivery_charges: { type: Number, default: 0 },
    total_amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR" },
    // Rich-text remarks (ProseMirror JSON; legacy records hold a plain string).
    remarks: { type: Schema.Types.Mixed },
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true },
    customer_address: String,
    project_id: { type: Schema.Types.ObjectId, ref: "Project" },
    converted_to: { type: Schema.Types.ObjectId, ref: "Invoice" },
    approved_at: Date,
    designId: String,
    rateSnapshot: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

quotationSchema.index({ org_id: 1, customer_id: 1, createdAt: -1 });
quotationSchema.index({ org_id: 1, status: 1, valid_until: 1 });
quotationSchema.index({ quotation_no: "text", customer_name: "text" });

quotationSchema.plugin(tenantScope);
quotationSchema.index({ org_id: 1, quotation_no: 1 }, { unique: true });

quotationSchema.pre("save", async function () {
  if (this.isNew && !this.quotation_no) {
    this.quotation_no = await getNextNumber(String(this.org_id), "quotation", "QT");
  }
});

const Quotation: Model<IQuotation> =
  mongoose.models.Quotation ||
  mongoose.model<IQuotation>("Quotation", quotationSchema);

export default Quotation;
