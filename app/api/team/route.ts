import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

const ALLOWED_ROLES = ["manager", "staff", "viewer"] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const users = await User.find({}, "-password").sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    console.error("[team GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch team" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // Only admins can invite team members
    const callerRole = (session.user as any)?.role;
    if (callerRole !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const { name, email, role } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ success: false, error: "Name and email required" }, { status: 400 });
    }

    const normalizedRole = role || "staff";
    if (!ALLOWED_ROLES.includes(normalizedRole as typeof ALLOWED_ROLES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
    }

    const tempPassword = randomBytes(12).toString("base64url");
    const hashed = await bcrypt.hash(tempPassword, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: normalizedRole,
    });

    return NextResponse.json(
      { success: true, data: { id: user._id, name: user.name, email: user.email, role: user.role } },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[team POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to invite" }, { status: 500 });
  }
}
