import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import type { SalaryComponent, PayslipLine } from "@/lib/payroll/types";

export type PayslipPaymentStatus = "unpaid" | "paid";

export interface IEmployeeSnapshot {
  employeeId: mongoose.Types.ObjectId;
  employee_code: string;
  name: string;
  designation?: string;
  department?: string;
  payCurrency: string;
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
}

export interface IPayslip extends Document {
  org_id?: mongoose.Types.ObjectId;
  payrollRunId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  payPeriodId: mongoose.Types.ObjectId;
  // Frozen at generation time — the engine reads only from these copies, so a later
  // salary/structure/config edit can never rewrite an already-processed payslip.
  employeeSnapshot: IEmployeeSnapshot;
  componentsSnapshot: SalaryComponent[];
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  gross: number;            // minor units, payCurrency
  totalDeductions: number;  // minor units, payCurrency
  net: number;              // minor units, payCurrency
  // Loan installments actually applied this slip — used to decrement loan balances
  // atomically at mark-paid (money only moves when the run is paid).
  appliedLoans: Array<{ loanId: mongoose.Types.ObjectId; amount: number }>;
  payCurrency: string;
  fxRate: number;           // foreign-per-base for payCurrency (1 if base)
  baseCurrency: string;
  baseCurrencyGross: number;
  baseCurrencyNet: number;
  taxableIncomeAnnual: number;
  paymentStatus: PayslipPaymentStatus;
  paidAt?: Date;
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema<PayslipLine>(
  { name: { type: String, required: true }, amount: { type: Number, required: true } },
  { _id: false }
);

const componentSnapshotSchema = new Schema<SalaryComponent>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["earning", "deduction"], required: true },
    calculation: { type: String, enum: ["fixed", "percentage_of_basic"], required: true },
    value: { type: Number, required: true },
    isBasic: { type: Boolean, default: false },
    taxable: { type: Boolean, default: true },
  },
  { _id: false }
);

const appliedLoanSchema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: "LoanAdvance", required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const employeeSnapshotSchema = new Schema<IEmployeeSnapshot>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    employee_code: { type: String, default: "" },
    name: { type: String, required: true },
    designation: String,
    department: String,
    payCurrency: { type: String, default: "PKR" },
    bankName: String,
    accountTitle: String,
    accountNumber: String,
    iban: String,
  },
  { _id: false }
);

const payslipSchema = new Schema<IPayslip>(
  {
    payrollRunId: { type: Schema.Types.ObjectId, ref: "PayrollRun", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    payPeriodId: { type: Schema.Types.ObjectId, ref: "PayPeriod", required: true },
    employeeSnapshot: { type: employeeSnapshotSchema, required: true },
    componentsSnapshot: { type: [componentSnapshotSchema], default: [] },
    earnings: { type: [lineSchema], default: [] },
    deductions: { type: [lineSchema], default: [] },
    gross: { type: Number, default: 0, min: 0 },
    totalDeductions: { type: Number, default: 0, min: 0 },
    net: { type: Number, default: 0, min: 0 },
    appliedLoans: { type: [appliedLoanSchema], default: [] },
    payCurrency: { type: String, default: "PKR" },
    fxRate: { type: Number, default: 1 },
    baseCurrency: { type: String, default: "PKR" },
    baseCurrencyGross: { type: Number, default: 0 },
    baseCurrencyNet: { type: Number, default: 0 },
    taxableIncomeAnnual: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    paidAt: Date,
    pdfUrl: String,
  },
  { timestamps: true, versionKey: false }
);

// One payslip per employee per run — the hard idempotency guarantee. A re-run insert
// throws E11000 and aborts the surrounding transaction.
payslipSchema.index({ org_id: 1, payrollRunId: 1, employeeId: 1 }, { unique: true });
payslipSchema.index({ org_id: 1, employeeId: 1, createdAt: -1 });
payslipSchema.index({ org_id: 1, payrollRunId: 1 });

payslipSchema.plugin(tenantScope);

const Payslip: Model<IPayslip> =
  mongoose.models.Payslip || mongoose.model<IPayslip>("Payslip", payslipSchema);

export default Payslip;
