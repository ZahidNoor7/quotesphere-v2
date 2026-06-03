import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import TimeEntry from "@/models/TimeEntry";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const timeEntrySchema = z.object({
  project_id:  z.string().min(1, "Project is required"),
  date:        z.string().min(1),
  hours:       z.number().min(0.01),
  description: z.string().min(1, "Description is required").max(500),
  hourly_rate: z.number().min(0).optional(),
  currency:    z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const).optional(),
});

export const GET = withLog("GET /api/time-entries", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    if (!project_id) return NextResponse.json({ success: false, error: "project_id required" }, { status: 400 });

    const entries = await TimeEntry.find({ project_id })
      .sort({ date: -1 })
      .lean();

    const totalHours  = (entries as any[]).reduce((s, e) => s + e.hours, 0);
    const totalAmount = (entries as any[]).reduce((s, e) => s + e.hours * (e.hourly_rate ?? 0), 0);

    return NextResponse.json({ success: true, data: entries, summary: { totalHours, totalAmount } });
  } catch (err) {
    console.error("[time-entries GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch time entries" }, { status: 500 });
  }
});

export const POST = withLog("POST /api/time-entries", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;
    await connectDB();

    const body = await req.json();
    const parsed = timeEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }

    const entry = await TimeEntry.create({
      ...parsed.data,
      user_id:   (session.user as any)?.id,
      user_name: session.user?.name ?? undefined,
    });
    void recordAudit({ req, session, action: "create", resource: "project", resource_id: String(parsed.data.project_id), resource_label: `Time: ${parsed.data.hours}h – ${parsed.data.description.slice(0, 40)}` });
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (err: any) {
    console.error("[time-entries POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create time entry" }, { status: 500 });
  }
});
