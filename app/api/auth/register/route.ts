import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password)
      return NextResponse.json({ success: false, error: "All fields required" }, { status: 400 });

    await connectDB();
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role: "admin" });

    return NextResponse.json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
