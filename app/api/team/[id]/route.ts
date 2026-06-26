import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import User from "@/models/User";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";

const roleSchema = z.object({ role: z.enum(["admin", "manager", "staff", "viewer"]) });

// Change a member's role. Admin-only, scoped to the caller's org (so an admin
// can never touch a user in another organization, even with a guessed id).
// Acting on yourself is blocked to prevent an admin from locking themselves out
// of admin access — which also guarantees the org always keeps ≥1 admin.
export const PATCH = withTenant(
  "PATCH /api/team/[id]",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, { session, orgId }) => {
    try {
      if (session.user?.role !== "admin") {
        return NextResponse.json({ success: false, error: "Only an organization admin can change roles." }, { status: 403 });
      }
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      if (id === session.user.id) {
        return NextResponse.json({ success: false, error: "You can't change your own role." }, { status: 400 });
      }
      const parsed = roleSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
      }

      const member = await User.findOneAndUpdate(
        { _id: id, org_id: orgId },
        { $set: { role: parsed.data.role } },
        { returnDocument: "after" },
      ).select("-password").lean() as { name?: string } | null;
      if (!member) return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });

      void recordAudit({
        req,
        session,
        action: "update",
        resource: "settings",
        resource_id: id,
        resource_label: `Role changed: ${member.name ?? id} → ${parsed.data.role}`,
      });
      return NextResponse.json({ success: true, data: member });
    } catch (err: any) {
      console.error("[team/[id] PATCH]", err);
      return NextResponse.json({ success: false, error: err.message || "Failed to change role" }, { status: 500 });
    }
  },
);

// Remove a member. Admin-only, org-scoped, and you can't remove yourself.
// (Org data is owned by org_id, not the user, so removal never orphans records.)
export const DELETE = withTenant(
  "DELETE /api/team/[id]",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, { session, orgId }) => {
    try {
      if (session.user?.role !== "admin") {
        return NextResponse.json({ success: false, error: "Only an organization admin can remove members." }, { status: 403 });
      }
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      if (id === session.user.id) {
        return NextResponse.json({ success: false, error: "You can't remove yourself." }, { status: 400 });
      }

      const member = await User.findOneAndDelete({ _id: id, org_id: orgId }).select("-password").lean() as { name?: string } | null;
      if (!member) return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });

      void recordAudit({
        req,
        session,
        action: "delete",
        resource: "settings",
        resource_id: id,
        resource_label: `Team member removed: ${member.name ?? id}`,
      });
      return NextResponse.json({ success: true, data: { id } });
    } catch (err: any) {
      console.error("[team/[id] DELETE]", err);
      return NextResponse.json({ success: false, error: err.message || "Failed to remove member" }, { status: 500 });
    }
  },
);
