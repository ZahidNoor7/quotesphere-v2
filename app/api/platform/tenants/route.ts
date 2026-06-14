import { NextRequest, NextResponse } from "next/server";
import { withPlatform, platformRead } from "@/lib/with-platform";
import Organization from "@/models/Organization";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { effectiveStatusOf, escapeRegex } from "@/lib/platform/summary";
import type { SubscriptionStatus } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUSES = new Set<SubscriptionStatus>([
  "trialing", "active", "past_due", "canceled", "expired", "suspended",
]);

export const GET = withPlatform("GET /api/platform/tenants", async (req: NextRequest) => {
  try {
    const settings = await getPlatformSettings();
    const grace = settings.default_grace_period_days;
    const now = new Date();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const search = (searchParams.get("search") ?? "").trim();
    const statusParam = searchParams.get("status") ?? "";
    const status = STATUSES.has(statusParam as SubscriptionStatus) ? statusParam : "";

    const pipeline: any[] = [];
    if (search) pipeline.push({ $match: { name: { $regex: escapeRegex(search), $options: "i" } } });
    pipeline.push(
      { $lookup: { from: "subscriptions", localField: "_id", foreignField: "org_id", as: "sub" } },
      { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },
    );
    if (status) pipeline.push({ $match: { "sub.status": status } });
    pipeline.push(
      { $lookup: { from: "users", localField: "owner_user_id", foreignField: "_id", as: "owner" } },
      { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                name: 1, createdAt: 1,
                "sub.status": 1, "sub.trial_ends_at": 1, "sub.current_period_end": 1,
                "sub.grace_ends_at": 1, "sub.grace_period_days_override": 1, "sub.plan_snapshot.name": 1,
                "sub.pending_change.plan_name": 1, "sub.pending_change.direction": 1,
                "owner.email": 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    );

    const agg = (await platformRead(() => Organization.aggregate(pipeline))) as any[];
    const rows = agg[0]?.rows ?? [];
    const total = agg[0]?.total?.[0]?.count ?? 0;

    const data = rows.map((o: any) => ({
      org_id: String(o._id),
      org_name: o.name,
      owner_email: o.owner?.email,
      created_at: new Date(o.createdAt).toISOString(),
      status: (o.sub?.status ?? "expired") as SubscriptionStatus,
      effectiveStatus: o.sub ? effectiveStatusOf(o.sub, grace, now) : "expired",
      plan_name: o.sub?.plan_snapshot?.name,
      trial_ends_at: o.sub?.trial_ends_at ? new Date(o.sub.trial_ends_at).toISOString() : null,
      current_period_end: o.sub?.current_period_end ? new Date(o.sub.current_period_end).toISOString() : null,
      pending_request: o.sub?.pending_change
        ? { plan_name: o.sub.pending_change.plan_name ?? "", direction: o.sub.pending_change.direction ?? "change" }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[platform/tenants GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load tenants" }, { status: 500 });
  }
});
