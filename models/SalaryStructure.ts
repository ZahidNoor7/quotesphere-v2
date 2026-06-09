import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import type { SalaryComponent } from "@/lib/payroll/types";

export type { SalaryComponent } from "@/lib/payroll/types";

export interface ISalaryStructure extends Document {
  org_id?: mongoose.Types.ObjectId;
  name: string;
  currency: string;
  active: boolean;
  components: SalaryComponent[];
  createdAt: Date;
  updatedAt: Date;
}

const componentSchema = new Schema<SalaryComponent>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["earning", "deduction"], required: true },
    calculation: { type: String, enum: ["fixed", "percentage_of_basic"], required: true },
    // `fixed` → minor units; `percentage_of_basic` → a percent (0–100).
    value: { type: Number, required: true, min: 0 },
    isBasic: { type: Boolean, default: false },
    taxable: { type: Boolean, default: true },
  },
  { _id: false }
);

const salaryStructureSchema = new Schema<ISalaryStructure>(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, default: "PKR" },
    active: { type: Boolean, default: true },
    components: { type: [componentSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

salaryStructureSchema.index({ org_id: 1, active: 1 });
salaryStructureSchema.index({ org_id: 1, name: 1 }, { unique: true });

salaryStructureSchema.plugin(tenantScope);

// Enforce exactly one basic component, and that it is a fixed earning — the basic is
// the reference every `percentage_of_basic` component resolves against.
salaryStructureSchema.pre("validate", function (this: ISalaryStructure) {
  const comps = this.components ?? [];
  if (comps.length === 0) return;
  const basics = comps.filter((c) => c.isBasic);
  if (basics.length !== 1) {
    this.invalidate("components", "A salary structure must have exactly one basic component");
    return;
  }
  const b = basics[0];
  if (b.type !== "earning" || b.calculation !== "fixed") {
    this.invalidate("components", "The basic component must be a fixed earning");
  }
});

const SalaryStructure: Model<ISalaryStructure> =
  mongoose.models.SalaryStructure ||
  mongoose.model<ISalaryStructure>("SalaryStructure", salaryStructureSchema);

export default SalaryStructure;
