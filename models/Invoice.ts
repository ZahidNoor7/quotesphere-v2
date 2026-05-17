import mongoose, { Schema, Document, Model } from "mongoose";
import { getNextNumber } from "./Counter";

export interface IPaymentEntry {
  _id?: string;
  date: Date;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "online" | "cheque";
  reference?: string;
  note?: string;
  createdAt: Date;
}

export interface IInvoiceItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  images?: string[];
}

export interface IInvoice extends Document {
  invoice_no: string;
  issue_date: Date;
  due_date?: Date;
  status: "draft" | "issued" | "cancelled";
  payment_status: "pending" | "partial" | "complete";
  payment_mode: "cash" | "card" | "online" | "bank_transfer" | "cheque";
  items: IInvoiceItem[];
  sub_total: number;
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  delivery_charges: number;
  total_amount: number;
  advance: number;
  balance: number;
  currency: string;
  remarks?: string;
  attachments?: string[];
  // Payment ledger — new
  payments: IPaymentEntry[];
  total_paid: number;
  outstanding: number;
  // Relations
  customer_id: mongoose.Types.ObjectId;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  project_id?: mongoose.Types.ObjectId;
  // Quotation link
  converted_from?: mongoose.Types.ObjectId;
  // Logistics
  delivery_status: "pending" | "shipped" | "delivered";
  tracking_no?: string;
  // Document design
  designId?: string;
  // Exchange rates at time of creation
  rateSnapshot?: Record<string, number>;
  // Recurring billing
  recurrence?: {
    frequency?: "weekly" | "monthly" | "quarterly" | "yearly";
    next_date?: Date;
    end_date?: Date;
    enabled?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const paymentEntrySchema = new Schema<IPaymentEntry>(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "online", "cheque"],
      required: true,
    },
    reference: String,
    note: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const itemSchema = new Schema<IInvoiceItem>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    images: [String],
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoice_no: { type: String, unique: true, index: true },
    issue_date: { type: Date, required: true },
    due_date: Date,
    status: { type: String, enum: ["draft", "issued", "cancelled"], default: "issued" },
    payment_status: { type: String, enum: ["pending", "partial", "complete"], default: "pending" },
    payment_mode: { type: String, enum: ["cash", "card", "online", "bank_transfer", "cheque"], default: "cash" },
    items: [itemSchema],
    sub_total: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    tax_type: { type: String, enum: ["percentage", "value"], default: "percentage" },
    discount: { type: Number, default: 0, min: 0 },
    delivery_charges: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, required: true, min: 0 },
    advance: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    remarks: String,
    attachments: [String],
    // Payment ledger
    payments: [paymentEntrySchema],
    total_paid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    // Relations
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true },
    customer_address: String,
    project_id: { type: Schema.Types.ObjectId, ref: "Project" },
    converted_from: { type: Schema.Types.ObjectId, ref: "Quotation" },
    // Logistics
    delivery_status: { type: String, enum: ["pending", "shipped", "delivered"], default: "pending" },
    tracking_no: String,
    // Document design
    designId: String,
    // Exchange rates frozen at creation time
    rateSnapshot: { type: Schema.Types.Mixed, default: {} },
    // Recurring billing
    recurrence: {
      frequency: { type: String, enum: ["weekly", "monthly", "quarterly", "yearly"] },
      next_date:  Date,
      end_date:   Date,
      enabled:    { type: Boolean, default: false },
    },
  },
  { timestamps: true, versionKey: false }
);

invoiceSchema.index({ customer_id: 1, createdAt: -1 });
invoiceSchema.index({ payment_status: 1, due_date: 1 });
invoiceSchema.index({ status: 1, issue_date: -1 });
invoiceSchema.index({ invoice_no: "text", customer_name: "text" });

invoiceSchema.pre("save", async function () {
  if (this.isNew && !this.invoice_no) {
    this.invoice_no = await getNextNumber("invoice", "INV");
  }
  // Recalculate outstanding
  this.total_paid = this.payments.reduce((s, p) => s + p.amount, 0) + this.advance;
  this.outstanding = Math.max(0, this.total_amount - this.total_paid);
  if (this.outstanding <= 0) this.payment_status = "complete";
  else if (this.total_paid > 0) this.payment_status = "partial";
  else this.payment_status = "pending";
  this.balance = this.outstanding;
});

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", invoiceSchema);

export default Invoice;
