import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/profile", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const userEmail = session.user.email as string;
    await connectDB();
    let user = userId ? await User.findById(userId).select("-password").lean().catch(() => null) : null;
    if (!user && userEmail) {
      user = await User.findOne({ email: userEmail }).select("-password").lean();
    }
    if (!user) {
      user = (await User.create({
        _id: userId || undefined,
        name: session.user.name ?? "User",
        email: userEmail,
        image: session.user.image ?? undefined,
        role: (session.user as any).role ?? "admin",
      })).toObject();
      delete (user as any).password;
    }
    return NextResponse.json({ success: true, data: user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const PUT = withLog("PUT /api/profile", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const userEmail = session.user.email as string;
    await connectDB();

    let userDoc = userId ? await User.findById(userId).select("+password").catch(() => null) : null;
    if (!userDoc && userEmail) userDoc = await User.findOne({ email: userEmail }).select("+password");
    if (!userDoc) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    const resolvedId = userDoc._id;

    const body = await req.json();
    const { name, phone, bio, image, currentPassword, newPassword } = body;

    const updateFields: Record<string, any> = {};
    if (name?.trim()) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone;
    if (bio !== undefined) updateFields.bio = bio;
    if (image !== undefined) updateFields.image = image;

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ success: false, error: "Current password required" }, { status: 400 });
      if (!userDoc.password) return NextResponse.json({ success: false, error: "No password set for this account (OAuth login)" }, { status: 400 });
      const match = await bcrypt.compare(currentPassword, userDoc.password);
      if (!match) return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
      if (newPassword.length < 8) return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
      updateFields.password = await bcrypt.hash(newPassword, 12);
    }

    const updated = await User.findByIdAndUpdate(resolvedId, { $set: updateFields }, { new: true }).select("-password").lean();
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
