import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import User from "@/models/User";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

// Team members belong to the caller's organization. `User` is not tenant-plugin'd
// (a user *has* an org rather than being an org-owned record), so org_id is
// filtered/stamped explicitly here.
export const GET = withTenant("GET /api/team", async (_req, _ctx, { orgId }) => {
  try {
    const users = await User.find({ org_id: orgId }, "-password").sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    console.error("[team GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch team" }, { status: 500 });
  }
});

const createMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(["admin", "manager", "staff", "viewer"]),
});

// Create a team member directly with credentials the admin chooses. The member
// can sign in immediately with that email + password and lands in this org.
export const POST = withTenant("POST /api/team", async (req: NextRequest, _ctx, { session, orgId }) => {
  try {
    if (session.user?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Only an organization admin can add members." }, { status: 403 });
    }

    const parsed = createMemberSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const { name, email, password, role } = parsed.data;

    // Email is globally unique on User — a person belongs to a single org.
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ success: false, error: "That email is already registered." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role,
      org_id: orgId,
    });

    void recordAudit({
      req,
      session,
      action: "create",
      resource: "settings",
      resource_id: String(user._id),
      resource_label: `Team member added: ${user.name} (${user.role})`,
    });

    return NextResponse.json(
      { success: true, data: { id: user._id, name: user.name, email: user.email, role: user.role } },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[team POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to add member" }, { status: 500 });
  }
});
