import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { withPlatform, platformRead } from "@/lib/with-platform";
import Organization from "@/models/Organization";
import Subscription from "@/models/Subscription";
import PaymentRecord from "@/models/PaymentRecord";
import User from "@/models/User";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { effectiveStatusOf } from "@/lib/platform/summary";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GET = withPlatform(
  "GET /api/platform/tenants/[id]",
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const settings = await getPlatformSettings();
      const grace = settings.default_grace_period_days;
      const now = new Date();

      const { id } = await params;
      if (!isValidObjectId(id)) {
        return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      }

      const org = (await platformRead(() => Organization.findById(id).lean())) as any;
      if (!org) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

      const [sub, owner, payments, memberCount] = await Promise.all([
        platformRead(() => Subscription.findOne({ org_id: id }).lean()),
        platformRead(() => User.findById(org.owner_user_id, { name: 1, email: 1 }).lean()),
        platformRead(() =>
          PaymentRecord.find({ org_id: id }).sort({ createdAt: -1 }).limit(50).lean(),
        ),
        platformRead(() => User.countDocuments({ org_id: id })),
      ]);

      const effectiveStatus = sub ? effectiveStatusOf(sub as any, grace, now) : "expired";

      return NextResponse.json({
        success: true,
        data: { org, subscription: sub, owner, payments, memberCount, effectiveStatus },
      });
    } catch (err) {
      console.error("[platform/tenants/[id] GET]", err);
      return NextResponse.json({ success: false, error: "Failed to load tenant" }, { status: 500 });
    }
  },
);
