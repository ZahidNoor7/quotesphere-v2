import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const payment_status = searchParams.get("payment_status") || "";
    const customer_id = searchParams.get("customer_id") || "";
    const project_id = searchParams.get("project_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const query: any = {};
    if (search) query.$text = { $search: search };
    if (status) query.status = status;
    if (payment_status) query.payment_status = payment_status;
    if (customer_id) query.customer_id = customer_id;
    if (project_id) query.project_id = project_id;
    if (from || to) {
      query.issue_date = {};
      if (from) query.issue_date.$gte = new Date(from);
      if (to) query.issue_date.$lte = new Date(to);
    }

    const total = await Invoice.countDocuments(query);
    const data = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[invoices GET]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await req.json();
    const invoice = new Invoice(body);
    await invoice.save();
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (err: any) {
    console.error("[invoices POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to create invoice" }, { status: 500 });
  }
}
