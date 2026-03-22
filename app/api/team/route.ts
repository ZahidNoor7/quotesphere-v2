import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const users = await User.find({}, "-password").sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: users });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch team" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { name, email, role } = await req.json();
    if (!name || !email) return NextResponse.json({ success: false, error: "Name and email required" }, { status: 400 });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });

    // Create user with temp password — they reset via login
    const tempPw = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: tempPw, role: role || "staff" });
    return NextResponse.json({ success: true, data: { id: user._id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to invite" }, { status: 500 });
  }
}
