import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const now = new Date();
    const [total, in_progress, overdue, budgetAgg] = await Promise.all([
      Project.countDocuments({}),
      Project.countDocuments({ status: "in_progress" }),
      Project.countDocuments({ due_date: { $lt: now }, status: { $nin: ["complete", "cancelled"] } }),
      Project.aggregate([{ $group: { _id: null, total: { $sum: "$budget" } } }]),
    ]);
    const total_budget = budgetAgg[0]?.total ?? 0;
    return NextResponse.json({ success: true, data: { total, in_progress, overdue, total_budget } });
  } catch { return NextResponse.json({ success: false, error: "Failed" }, { status: 500 }); }
}
