import { NextRequest, NextResponse } from "next/server";
import { withPlatform, platformRead } from "@/lib/with-platform";
import Subscription from "@/models/Subscription";
import PaymentRecord from "@/models/PaymentRecord";
import { getPlatformSettings } from "@/models/PlatformSettings";
import { effectiveStatusOf } from "@/lib/platform/summary";
import type { SubscriptionStatus } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUSES = new Set<SubscriptionStatus>([
  "trialing", "active", "past_due", "canceled", "expired", "suspended",
]);

export const GET = withPlatform("GET /api/platform/subscriptions", async (req: NextRequest) => {
  try {
    const settings = await getPlatformSettings();
    const grace = settings.default_grace_period_days;
    const now = new Date();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const statusParam = searchParams.get("status") ?? "";
    const status = STATUSES.has(statusParam as SubscriptionStatus) ? statusParam : "";

    const pipeline: any[] = [];
    if (status) pipeline.push({ $match: { status } });
    pipeline.push(
      { $lookup: { from: "organizations", localField: "org_id", foreignField: "_id", as: "org" } },
      { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
      { $sort: { updatedAt: -1 } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                org_id: 1, status: 1, "plan_snapshot.name": 1, "plan_snapshot.currency": 1,
                trial_ends_at: 1, current_period_end: 1, grace_ends_at: 1, grace_period_days_override: 1,
                updatedAt: 1, "org.name": 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    );

    const [agg, recentPayments] = await Promise.all([
      platformRead(() => Subscription.aggregate(pipeline)) as Promise<any[]>,
      platformRead(() =>
        PaymentRecord.aggregate([
          { $sort: { createdAt: -1 } },
          { $limit: 25 },
          { $lookup: { from: "organizations", localField: "org_id", foreignField: "_id", as: "org" } },
          { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              amount: 1, currency: 1, status: 1, method: 1, plan_slug: 1,
              createdAt: 1, paid_at: 1, "org.name": 1,
            },
          },
        ]),
      ) as Promise<any[]>,
    ]);

    const rows = agg[0]?.rows ?? [];
    const total = agg[0]?.total?.[0]?.count ?? 0;

    const subscriptions = rows.map((s: any) => ({
      org_id: String(s.org_id),
      org_name: s.org?.name ?? "—",
      status: s.status as SubscriptionStatus,
      effectiveStatus: effectiveStatusOf(s, grace, now),
      plan_name: s.plan_snapshot?.name,
      currency: s.plan_snapshot?.currency,
      trial_ends_at: s.trial_ends_at ? new Date(s.trial_ends_at).toISOString() : null,
      current_period_end: s.current_period_end ? new Date(s.current_period_end).toISOString() : null,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
    }));

    const payments = (recentPayments ?? []).map((p: any) => ({
      org_name: p.org?.name ?? "—",
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method,
      plan_slug: p.plan_slug,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      data: { subscriptions, payments, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } },
    });
  } catch (err) {
    console.error("[platform/subscriptions GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load subscriptions" }, { status: 500 });
  }
});
