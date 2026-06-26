import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { withPlatform, platformRead } from "@/lib/with-platform";
import { recordPlatformAudit } from "@/lib/platform-audit";
import Plan from "@/models/Plan";
import { sanitizeFeatureKeys } from "@/lib/entitlements/features";

/* eslint-disable @typescript-eslint/no-explicit-any */

const planUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(400).optional(),
  billing_interval: z.enum(["monthly", "annual", "lifetime"]).optional(),
  price_pkr: z.coerce.number().min(0).optional(),
  price_usd: z.coerce.number().min(0).optional(),
  features: z.array(z.string()).optional(),
  limits: z.object({ maxTeamMembers: z.coerce.number().int().min(0).optional() }).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

export const PUT = withPlatform(
  "PUT /api/platform/plans/[id]",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, platform) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      const parsed = planUpdateSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
      }
      const update: any = { ...parsed.data };
      if (update.features) update.features = sanitizeFeatureKeys(update.features);

      const before = (await platformRead(() => Plan.findById(id).lean())) as any;
      if (!before) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

      const plan = await Plan.findByIdAndUpdate(id, update, { returnDocument: "after" });
      await recordPlatformAudit({
        req, platformAdminId: platform.platformAdminId, actorEmail: platform.adminEmail,
        action: "plan.update", before, after: plan?.toObject(),
      });
      return NextResponse.json({ success: true, data: plan });
    } catch (err: any) {
      if (err?.code === 11000) {
        return NextResponse.json({ success: false, error: "A plan with that slug already exists." }, { status: 409 });
      }
      console.error("[platform/plans/[id] PUT]", err);
      return NextResponse.json({ success: false, error: "Failed to update plan" }, { status: 500 });
    }
  },
);

export const DELETE = withPlatform(
  "DELETE /api/platform/plans/[id]",
  async (req, { params }: { params: Promise<{ id: string }> }, platform) => {
    try {
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      const plan = (await platformRead(() => Plan.findById(id).lean())) as any;
      if (!plan) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      if (plan.is_grandfather) {
        return NextResponse.json(
          { success: false, error: "The grandfathered plan is internal and cannot be deleted." },
          { status: 409 },
        );
      }
      // Existing subscriptions keep their frozen snapshot, so deleting a catalog
      // entry never alters a live subscription. Deactivate instead if you want to
      // hide it but keep it referenced.
      await Plan.findByIdAndDelete(id);
      await recordPlatformAudit({
        req, platformAdminId: platform.platformAdminId, actorEmail: platform.adminEmail,
        action: "plan.delete", before: plan,
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[platform/plans/[id] DELETE]", err);
      return NextResponse.json({ success: false, error: "Failed to delete plan" }, { status: 500 });
    }
  },
);
