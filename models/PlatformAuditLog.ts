import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Immutable audit trail for cross-tenant platform actions. GLOBAL / NOT
 * tenant-scoped (written in bypass mode). Kept separate from the tenant-facing
 * `AuditLog` so platform actions never surface in a tenant's own audit view and
 * are NOT TTL-purged. Every cross-tenant mutation in the portal writes one of these.
 */
export interface IPlatformAuditLog extends Document {
  actor_platform_admin_id?: mongoose.Types.ObjectId;
  actor_email: string;
  action: string;
  target_org_id?: mongoose.Types.ObjectId;
  target_org_name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string;
  createdAt: Date;
}

const platformAuditLogSchema = new Schema<IPlatformAuditLog>(
  {
    actor_platform_admin_id: { type: Schema.Types.ObjectId, ref: "PlatformAdmin" },
    actor_email: { type: String, default: "" },
    action: { type: String, required: true },
    target_org_id: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    target_org_name: { type: String, default: "" },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: "platformauditlogs" },
);

platformAuditLogSchema.index({ actor_platform_admin_id: 1, createdAt: -1 });
platformAuditLogSchema.index({ target_org_id: 1, createdAt: -1 });
platformAuditLogSchema.index({ action: 1, createdAt: -1 });
platformAuditLogSchema.index({ createdAt: -1 });

const PlatformAuditLog: Model<IPlatformAuditLog> =
  mongoose.models.PlatformAuditLog ||
  mongoose.model<IPlatformAuditLog>("PlatformAuditLog", platformAuditLogSchema);

export default PlatformAuditLog;
