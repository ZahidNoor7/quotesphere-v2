import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";

export type LoanStatus = "active" | "closed";
export type LoanType = "loan" | "advance";

export interface ILoanAdvance extends Document {
  org_id?: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  type: LoanType;
  principal: number;          // minor units
  installmentAmount: number;  // minor units, deducted each pay period
  remainingBalance: number;   // minor units
  currency: string;
  status: LoanStatus;
  startDate: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const loanAdvanceSchema = new Schema<ILoanAdvance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    type: { type: String, enum: ["loan", "advance"], default: "loan" },
    principal: { type: Number, required: true, min: 0 },
    installmentAmount: { type: Number, required: true, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR" },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    startDate: { type: Date, default: Date.now },
    note: String,
  },
  { timestamps: true, versionKey: false }
);

loanAdvanceSchema.index({ org_id: 1, employeeId: 1, status: 1 });

loanAdvanceSchema.plugin(tenantScope);

const LoanAdvance: Model<ILoanAdvance> =
  mongoose.models.LoanAdvance || mongoose.model<ILoanAdvance>("LoanAdvance", loanAdvanceSchema);

export default LoanAdvance;
