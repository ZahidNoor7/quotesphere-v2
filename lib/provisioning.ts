import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import Organization from "@/models/Organization";

/**
 * Create a new organization owned by `userId` and link the user to it.
 * Returns the new org id as a string. `User` and `Organization` are NOT
 * tenant-scoped, so this is safe to call outside any tenant context.
 */
export async function createOrgForUser(userId: string, name: string): Promise<string> {
  const org = await Organization.create({ name, owner_user_id: userId });
  await User.updateOne({ _id: userId }, { $set: { org_id: org._id } });
  return String(org._id);
}

/**
 * Ensure a user has an organization, creating one on first need. Used to
 * bootstrap OAuth users (who are created by the Auth.js adapter and never hit
 * the credentials register route). Idempotent: returns the existing org if set.
 */
export async function ensureUserOrg(
  userId: string,
  displayName?: string | null,
): Promise<string | undefined> {
  await connectDB();
  const user = await User.findById(userId)
    .select("org_id name email")
    .lean<{ org_id?: mongoose.Types.ObjectId; name?: string; email?: string } | null>();
  if (!user) return undefined;
  if (user.org_id) return String(user.org_id);
  const base = displayName || user.name || user.email || "My";
  return createOrgForUser(userId, `${base}'s Organization`);
}
