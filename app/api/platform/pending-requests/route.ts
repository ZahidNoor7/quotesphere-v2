import { NextResponse } from "next/server";
import { withPlatform, platformRead } from "@/lib/with-platform";
import Subscription from "@/models/Subscription";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** All tenants with an open plan-change request — for the portal's central
 *  visibility (overview section + nav badge). */
export const GET = withPlatform("GET /api/platform/pending-requests", async () => {
  try {
    const rows = (await platformRead(() =>
      Subscription.aggregate([
        { $match: { pending_change: { $ne: null } } },
        { $lookup: { from: "organizations", localField: "org_id", foreignField: "_id", as: "org" } },
        { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
        { $sort: { "pending_change.requested_at": -1 } },
        {
          $project: {
            org_id: 1,
            status: 1,
            "org.name": 1,
            "pending_change.plan_name": 1,
            "pending_change.direction": 1,
            "pending_change.requested_at": 1,
          },
        },
      ]),
    )) as any[];

    const data = rows.map((r) => ({
      org_id: String(r.org_id),
      org_name: r.org?.name ?? "—",
      plan_name: r.pending_change?.plan_name ?? "",
      direction: r.pending_change?.direction ?? "change",
      requested_at: r.pending_change?.requested_at ? new Date(r.pending_change.requested_at).toISOString() : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[platform/pending-requests GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load requests" }, { status: 500 });
  }
});
