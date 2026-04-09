import mongoose, { Schema, Document, Model } from "mongoose";
import { getNextNumber } from "./Counter";

export interface IExpenseItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  category?: string;
}

export interface IExpense extends Document {
  expense_no: string;
  bill_date: Date;
  vendor_name?: string;
  bill_number?: string;
  status: "draft" | "recorded" | "verified" | "cancelled";
  payment_status: "pending" | "paid" | "partial";
  payment_method?: "cash" | "card" | "online" | "cheque" | "bank_transfer";
  items: IExpenseItem[];
  sub_total: number;
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  total_amount: number;
  currency: string;
  notes?: string;
  bill_images: string[];
  // Relations
  customer_id: mongoose.Types.ObjectId;
  customer_name: string;
  customer_phone: string;
  project_id?: mongoose.Types.ObjectId;
  invoice_id?: mongoose.Types.ObjectId;
  quotation_id?: mongoose.Types.ObjectId;
  rateSnapshot?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const expenseItemSchema = new Schema<IExpenseItem>(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit_price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    category: String,
  },
  { _id: false }
);

const expenseSchema = new Schema<IExpense>(
  {
    expense_no: { type: String, unique: true, index: true },
    bill_date: { type: Date, required: true },
    vendor_name: String,
    bill_number: String,
    status: { type: String, enum: ["draft", "recorded", "verified", "cancelled"], default: "recorded" },
    payment_status: { type: String, enum: ["pending", "paid", "partial"], default: "pending" },
    payment_method: { type: String, enum: ["cash", "card", "online", "cheque", "bank_transfer"] },
    items: [expenseItemSchema],
    sub_total: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0 },
    tax_type: { type: String, enum: ["percentage", "value"], default: "percentage" },
    discount: { type: Number, default: 0 },
    total_amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR" },
    notes: String,
    bill_images: [String],
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true },
    project_id: { type: Schema.Types.ObjectId, ref: "Project" },
    invoice_id: { type: Schema.Types.ObjectId, ref: "Invoice" },
    quotation_id: { type: Schema.Types.ObjectId, ref: "Quotation" },
    rateSnapshot: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
);

expenseSchema.index({ customer_id: 1, createdAt: -1 });
expenseSchema.index({ status: 1, bill_date: -1 });
expenseSchema.index({ expense_no: "text", vendor_name: "text", customer_name: "text" });

expenseSchema.pre("save", async function () {
  if (this.isNew && !this.expense_no) {
    this.expense_no = await getNextNumber("expense", "EXP");
  }
});

const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", expenseSchema);

export default Expense;
