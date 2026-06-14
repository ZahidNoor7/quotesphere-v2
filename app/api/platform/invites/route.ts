import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { withPlatform, platformRead } from "@/lib/with-platform";
import { recordPlatformAudit } from "@/lib/platform-audit";
import TenantInvite from "@/models/TenantInvite";

/* eslint-disable @typescript-eslint/no-explicit-any */

const inviteSchema = z.object({
  email: z.email(),
  trialDays: z.coerce.number().int().min(0).max(3650).optional(),
  planId: z.string().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).default(14),
  note: z.string().max(300).optional(),
});

export const GET = withPlatform("GET /api/platform/invites", async () => {
  try {
    const invites = await platformRead(() =>
      TenantInvite.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        { $lookup: { from: "plans", localField: "plan_id_override", foreignField: "_id", as: "plan" } },
        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            email: 1, token: 1, trial_days_override: 1, status: 1,
            expires_at: 1, consumed_at: 1, createdAt: 1, note: 1, "plan.name": 1,
          },
        },
      ]),
    );
    return NextResponse.json({ success: true, data: invites });
  } catch (err) {
    console.error("[platform/invites GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load invites" }, { status: 500 });
  }
});

export const POST = withPlatform("POST /api/platform/invites", async (req: NextRequest, _ctx, platform) => {
  try {
    const parsed = inviteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const { email, trialDays, planId, expiresInDays, note } = parsed.data;
    const now = new Date();
    const invite = await TenantInvite.create({
      email: email.toLowerCase(),
      token: randomBytes(24).toString("hex"),
      trial_days_override: trialDays ?? null,
      plan_id_override: planId || null,
      status: "pending",
      created_by: platform.platformAdminId,
      expires_at: new Date(now.getTime() + expiresInDays * 86400000),
      note: note ?? "",
    });
    await recordPlatformAudit({
      req, platformAdminId: platform.platformAdminId, actorEmail: platform.adminEmail,
      action: "invite.create", after: { email: invite.email, trial_days_override: invite.trial_days_override },
    });
    return NextResponse.json({ success: true, data: invite }, { status: 201 });
  } catch (err) {
    console.error("[platform/invites POST]", err);
    return NextResponse.json({ success: false, error: "Failed to create invite" }, { status: 500 });
  }
});
