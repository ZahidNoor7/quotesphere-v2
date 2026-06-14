import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPlatform, platformRead } from "@/lib/with-platform";
import { recordPlatformAudit } from "@/lib/platform-audit";
import Plan from "@/models/Plan";
import { sanitizeFeatureKeys } from "@/lib/entitlements/features";

/* eslint-disable @typescript-eslint/no-explicit-any */

const planSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().max(400).optional().default(""),
  billing_interval: z.enum(["monthly", "annual", "lifetime"]),
  price_pkr: z.coerce.number().min(0).default(0),
  price_usd: z.coerce.number().min(0).default(0),
  features: z.array(z.string()).default([]),
  limits: z.object({ maxTeamMembers: z.coerce.number().int().min(0).optional() }).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

export const GET = withPlatform("GET /api/platform/plans", async () => {
  try {
    const plans = await platformRead(() => Plan.find({}).sort({ sort_order: 1, createdAt: 1 }).lean());
    return NextResponse.json({ success: true, data: plans });
  } catch (err) {
    console.error("[platform/plans GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load plans" }, { status: 500 });
  }
});

export const POST = withPlatform("POST /api/platform/plans", async (req: NextRequest, _ctx, platform) => {
  try {
    const parsed = planSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const data = { ...parsed.data, features: sanitizeFeatureKeys(parsed.data.features) };
    const plan = await Plan.create(data);
    await recordPlatformAudit({
      req, platformAdminId: platform.platformAdminId, actorEmail: platform.adminEmail,
      action: "plan.create", after: plan.toObject(),
    });
    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json({ success: false, error: "A plan with that slug already exists." }, { status: 409 });
    }
    console.error("[platform/plans POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create plan" }, { status: 500 });
  }
});
