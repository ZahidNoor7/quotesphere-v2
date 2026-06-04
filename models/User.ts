import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  phone?: string;
  bio?: string;
  role: "admin" | "manager" | "staff" | "viewer";
  org_id?: mongoose.Types.ObjectId;
  emailVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, select: false },
    image: String,
    phone: String,
    bio: String,
    role: { type: String, enum: ["admin", "manager", "staff", "viewer"], default: "staff" },
    org_id: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    emailVerified: Date,
  },
  { timestamps: true, versionKey: false }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;
