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
    // Unique so a concurrent first-login (OAuth) can't bootstrap two orgs for the
    // same owner — the second create fails E11000 and reuses the first (see
    // lib/provisioning.ts::createOrgForUser).
    owner_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  },
  { timestamps: true, versionKey: false },
);

const Organization: Model<IOrganization> =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", organizationSchema);

export default Organization;
