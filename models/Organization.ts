import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * An Organization is the tenant boundary. Every business document belongs to
 * exactly one org (via `org_id`), and users belong to one org (`User.org_id`).
 * The org itself is NOT tenant-scoped — it *is* the tenant.
 */
export interface IOrganization extends Document {
  name: string;
  owner_user_id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    owner_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

const Organization: Model<IOrganization> =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", organizationSchema);

export default Organization;
