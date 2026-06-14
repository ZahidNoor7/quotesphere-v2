import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPlatform } from "@/lib/with-platform";
import { recordPlatformAudit } from "@/lib/platform-audit";
import PlatformSettings, { getPlatformSettings } from "@/models/PlatformSettings";

const settingsSchema = z.object({
  default_trial_days: z.coerce.number().int().min(0).max(3650).optional(),
  default_grace_period_days: z.coerce.number().int().min(0).max(90).optional(),
  default_currency: z.enum(["PKR", "USD"]).optional(),
});

export const GET = withPlatform("GET /api/platform/settings", async () => {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    console.error("[platform/settings GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load settings" }, { status: 500 });
  }
});

export const PUT = withPlatform("PUT /api/platform/settings", async (req: NextRequest, _ctx, platform) => {
  try {
    const parsed = settingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const before = await getPlatformSettings();
    const settings = await PlatformSettings.findOneAndUpdate(
      { key: "global" },
      { $set: parsed.data },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await recordPlatformAudit({
      req, platformAdminId: platform.platformAdminId, actorEmail: platform.adminEmail,
      action: "settings.update", before: before.toObject?.() ?? before, after: settings?.toObject(),
    });
    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    console.error("[platform/settings PUT]", err);
    return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
  }
});
