import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import type { TaxSlab, EobiConfig, ProvidentFundConfig } from "@/lib/payroll/types";

export interface IPayrollConfig extends Document {
  org_id?: mongoose.Types.ObjectId;
  taxYearLabel: string;
  currency: string;
  taxSlabs: TaxSlab[];
  eobi: EobiConfig;
  providentFund: ProvidentFundConfig;
  statutory: { taxEnabled: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const taxSlabSchema = new Schema<TaxSlab>(
  {
    minAnnual: { type: Number, required: true, min: 0 },   // minor units
    maxAnnual: { type: Number, default: null },             // minor units; null = open top
    fixedAmount: { type: Number, default: 0, min: 0 },      // minor units
    ratePercent: { type: Number, default: 0, min: 0 },      // percent
  },
  { _id: false }
);

const payrollConfigSchema = new Schema<IPayrollConfig>(
  {
    taxYearLabel: { type: String, default: "2025-26" },
    currency: { type: String, default: "PKR" },
    taxSlabs: { type: [taxSlabSchema], default: [] },
    eobi: {
      enabled: { type: Boolean, default: true },
      employeeRate: { type: Number, default: 1 },   // percent of minWage
      employerRate: { type: Number, default: 5 },   // percent of minWage
      minWage: { type: Number, default: 0 },         // minor units
    },
    providentFund: {
      enabled: { type: Boolean, default: false },
      employeeRate: { type: Number, default: 0 },   // percent of basic
      employerRate: { type: Number, default: 0 },   // percent of basic
    },
    statutory: {
      taxEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true, versionKey: false }
);

// Exactly one PayrollConfig per organization (mirrors Settings).
payrollConfigSchema.plugin(tenantScope, { unique: true });

const PayrollConfig: Model<IPayrollConfig> =
  mongoose.models.PayrollConfig ||
  mongoose.model<IPayrollConfig>("PayrollConfig", payrollConfigSchema);

export default PayrollConfig;
