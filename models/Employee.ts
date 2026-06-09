import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";
import { getNextNumber } from "./Counter";

export type EmploymentType = "full_time" | "contract";
export type EmployeeStatus = "active" | "inactive";

export interface IBankDetails {
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
}

export interface IEmployee extends Document {
  org_id?: mongoose.Types.ObjectId;
  employee_code: string;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  employmentType: EmploymentType;
  joinDate: Date;
  status: EmployeeStatus;
  bankDetails?: IBankDetails;
  payCurrency: string;
  salaryStructureId?: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    bankName: String,
    accountTitle: String,
    accountNumber: String,
    iban: String,
  },
  { _id: false }
);

const employeeSchema = new Schema<IEmployee>(
  {
    employee_code: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    employmentType: { type: String, enum: ["full_time", "contract"], default: "full_time" },
    joinDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    bankDetails: { type: bankDetailsSchema, default: {} },
    payCurrency: { type: String, default: "PKR" },
    salaryStructureId: { type: Schema.Types.ObjectId, ref: "SalaryStructure" },
    // Reserved link to an app User for future self-service; no functional link yet.
    user_id: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true, versionKey: false }
);

employeeSchema.index({ org_id: 1, employee_code: 1 }, { unique: true });
employeeSchema.index({ org_id: 1, status: 1, department: 1 });
employeeSchema.index({ name: "text", employee_code: "text", email: "text" });

employeeSchema.plugin(tenantScope);

employeeSchema.pre("save", async function (this: IEmployee) {
  // org_id is stamped by the tenant plugin during pre-validate, which runs first.
  if (this.isNew && !this.employee_code) {
    this.employee_code = await getNextNumber(String(this.org_id), "employee", "EMP");
  }
});

const Employee: Model<IEmployee> =
  mongoose.models.Employee || mongoose.model<IEmployee>("Employee", employeeSchema);

export default Employee;
