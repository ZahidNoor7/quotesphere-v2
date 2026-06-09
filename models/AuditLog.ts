import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";

export type AuditAction = "create" | "update" | "delete";
export type AuditResource =
  | "invoice" | "quotation" | "expense" | "project"
  | "customer" | "service" | "product" | "template" | "settings"
  | "employee" | "salary_structure" | "pay_period"
  | "payroll_run" | "payslip" | "payroll_config" | "loan_advance";

export interface IAuditLog extends Document {
  org_id?:        mongoose.Types.ObjectId;
  user_id:        string;
  user_name:      string;
  user_email:     string;
  action:         AuditAction;
  resource:       AuditResource;
  resource_id:    string;
  resource_label: string;
  before:         Record<string, unknown> | null;
  after:          Record<string, unknown> | null;
  ip:             string;
  createdAt:      Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user_id:        { type: String, required: true },
    user_name:      { type: String, default: "" },
    user_email:     { type: String, default: "" },
    action:         { type: String, enum: ["create", "update", "delete"], required: true },
    resource:       { type: String, required: true },
    resource_id:    { type: String, required: true },
    resource_label: { type: String, default: "" },
    before:         { type: Schema.Types.Mixed, default: null },
    after:          { type: Schema.Types.Mixed, default: null },
    ip:             { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Fast queries for the audit log UI
auditLogSchema.index({ resource: 1, createdAt: -1 });
auditLogSchema.index({ user_id: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Auto-expire logs after 2 years (TTL index)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

// org_id is optional: audit entries are also written from system paths (cron,
// webhook) that run in bypass mode with no org context.
auditLogSchema.plugin(tenantScope, { required: false });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;
