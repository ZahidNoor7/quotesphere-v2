import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import AuditLog from "@/models/AuditLog";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";

export const GET = withTenant("GET /api/audit-log", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    // Viewers can see the audit log; only admins/managers can
    const denied = requireRole(session, "GET", "settings");
    if (denied) return denied;

    await connectDB();

    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30")));
    const resource = searchParams.get("resource") || "";
    const action   = searchParams.get("action")   || "";
    const user_id  = searchParams.get("user_id")  || "";
    const from     = searchParams.get("from")     || "";
    const to       = searchParams.get("to")       || "";
    const search   = searchParams.get("search")   || "";

    const query: Record<string, unknown> = {};
    if (resource) query.resource = resource;
    if (action)   query.action   = action;
    if (user_id)  query.user_id  = user_id;
    if (search)   query.resource_label = { $regex: search, $options: "i" };
    if (from || to) {
      const dateQ: Record<string, Date> = {};
      if (from) dateQ.$gte = new Date(from);
      if (to)   { const d = new Date(to); d.setHours(23, 59, 59, 999); dateQ.$lte = d; }
      query.createdAt = dateQ;
    }

    const [total, data] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[audit-log GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch audit log" }, { status: 500 });
  }
});
