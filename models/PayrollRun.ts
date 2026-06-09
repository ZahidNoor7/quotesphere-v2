import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import { getNextNumber } from "./Counter";

export type PayrollRunStatus = "draft" | "pending_approval" | "approved" | "paid" | "cancelled";

export interface IFxSnapshot {
  base: string;
  rates: Record<string, number>;
  capturedAt: Date;
}

export interface IPayrollRunTotals {
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
  employerCostTotal: number;
  employeeCount: number;
}

export interface IPayrollRun extends Document {
  org_id?: mongoose.Types.ObjectId;
  run_no: string;
  payPeriodId: mongoose.Types.ObjectId;
  status: PayrollRunStatus;
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  paidAt?: Date;
  // Set to the payPeriodId while the run is live; $unset on cancel. Backs the
  // partial-unique index that guarantees at most one live run per period.
  period_lock?: mongoose.Types.ObjectId;
  fxRateUsed: IFxSnapshot;
  totals: IPayrollRunTotals;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fxSnapshotSchema = new Schema<IFxSnapshot>(
  {
    base: { type: String, default: "PKR" },
    rates: { type: Schema.Types.Mixed, default: {} },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const totalsSchema = new Schema<IPayrollRunTotals>(
  {
    grossTotal: { type: Number, default: 0 },
    deductionsTotal: { type: Number, default: 0 },
    netTotal: { type: Number, default: 0 },
    employerCostTotal: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const payrollRunSchema = new Schema<IPayrollRun>(
  {
    run_no: { type: String, index: true },
    payPeriodId: { type: Schema.Types.ObjectId, ref: "PayPeriod", required: true },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "paid", "cancelled"],
      default: "draft",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    paidAt: Date,
    period_lock: { type: Schema.Types.ObjectId, ref: "PayPeriod" },
    fxRateUsed: {
      type: fxSnapshotSchema,
      default: () => ({ base: "PKR", rates: {}, capturedAt: new Date() }),
    },
    totals: { type: totalsSchema, default: () => ({}) },
    notes: String,
  },
  { timestamps: true, versionKey: false }
);

payrollRunSchema.index({ org_id: 1, run_no: 1 }, { unique: true });
// At most one live (non-cancelled) run per period per org. Uses a `period_lock`
// marker + an $exists partial filter (supported on every MongoDB version), so a
// concurrent second create for the same period fails with E11000 and its
// transaction aborts. Cancelling a run $unsets period_lock and frees the period.
payrollRunSchema.index(
  { org_id: 1, period_lock: 1 },
  { unique: true, partialFilterExpression: { period_lock: { $exists: true } } }
);
payrollRunSchema.index({ org_id: 1, status: 1, createdAt: -1 });

payrollRunSchema.plugin(tenantScope);

payrollRunSchema.pre("save", async function (this: IPayrollRun) {
  if (this.isNew && !this.run_no) {
    this.run_no = await getNextNumber(String(this.org_id), "payroll_run", "PR");
  }
});

const PayrollRun: Model<IPayrollRun> =
  mongoose.models.PayrollRun || mongoose.model<IPayrollRun>("PayrollRun", payrollRunSchema);

export default PayrollRun;
