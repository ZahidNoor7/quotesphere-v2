import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { withLog } from "@/lib/logger";
import { sendWelcomeEmail } from "@/lib/email";
import { createOrgForUser } from "@/lib/provisioning";
import { runWithOrg } from "@/lib/tenant-context";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const POST = withLog("POST /api/auth/register", async (req: NextRequest) => {
  const ip = getClientIP(req);
  const rl = await rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: z.flattenError(parsed.error).fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    await connectDB();
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
    }

    // A self-signup always creates and owns a brand-new organization, so they
    // are that org's admin. Invited teammates get their role from /api/team.
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role: "admin" });
    const orgId = await createOrgForUser(String(user._id), `${name}'s Organization`);

    // Fire-and-forget — don't let email failure block registration. Run in the
    // new org's context so any Settings-based email config resolves cleanly
    // (falls back to env Resend, since a brand-new org has none configured yet).
    runWithOrg(orgId, () =>
      sendWelcomeEmail({
        to: user.email,
        name: user.name,
        loginUrl: process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/auth/login` : undefined,
      }),
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email, role: user.role, org_id: orgId },
    });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
});
