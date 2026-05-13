import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Expense from "@/models/Expense";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/expenses", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const customer_id = searchParams.get("customer_id") || "";
    const project_id = searchParams.get("project_id") || "";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (customer_id) query.customer_id = customer_id;
    if (project_id) query.project_id = project_id;

    const total = await Expense.countDocuments(query);
    const data = await Expense.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return NextResponse.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("[expenses GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch expenses" }, { status: 500 });
  }
});

export const POST = withLog("POST /api/expenses", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const expense = new Expense(body);
    await expense.save();
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (err: any) {
    console.error("[expenses POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create expense" }, { status: 500 });
  }
});
