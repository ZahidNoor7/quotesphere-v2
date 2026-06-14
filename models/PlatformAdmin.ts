import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * A platform super-admin — a DISTINCT identity from tenant `User`s. Lives in its
 * own collection so a tenant user has no field/path that could escalate to
 * platform access. Authenticated via the dedicated "platform-credentials" Auth.js
 * provider (see auth.ts). Seeded only via scripts/seed-platform-admin (never a
 * public route).
 */
export interface IPlatformAdmin extends Document {
  email: string;
  password?: string;
  name: string;
  is_active: boolean;
  last_login_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const platformAdminSchema = new Schema<IPlatformAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never selected by default — must `.select("+password")` to read for bcrypt compare.
    password: { type: String, select: false },
    name: { type: String, default: "" },
    is_active: { type: Boolean, default: true },
    last_login_at: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: "platformadmins" },
);

const PlatformAdmin: Model<IPlatformAdmin> =
  mongoose.models.PlatformAdmin ||
  mongoose.model<IPlatformAdmin>("PlatformAdmin", platformAdminSchema);

export default PlatformAdmin;
