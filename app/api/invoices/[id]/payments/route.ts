import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import { withLog } from "@/lib/logger";

export const POST = withLog("POST /api/invoices/[id]/payments", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const { date, amount, method, reference, note } = await req.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be a positive number" }, { status: 400 });
    }

    const newPayment = {
      _id: new mongoose.Types.ObjectId(),
      date: date ? new Date(date) : new Date(),
      amount,
      method: method ?? "cash",
      reference: reference ?? undefined,
      note: note ?? undefined,
      createdAt: new Date(),
    };

    const updated = await Invoice.findOneAndUpdate(
      {
        _id: id,
        payment_status: { $ne: "complete" },
        outstanding: { $gte: amount - 0.001 },
      },
      [
        { $set: { payments: { $concatArrays: ["$payments", [newPayment]] } } },
        {
          $set: {
            total_paid: {
              $add: [
                { $reduce: { input: "$payments", initialValue: 0, in: { $add: ["$$value", "$$this.amount"] } } },
                { $ifNull: ["$advance", 0] },
              ],
            },
          },
        },
        {
          $set: {
            outstanding: { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
            balance:     { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
          },
        },
        {
          $set: {
            payment_status: {
              $switch: {
                branches: [
                  { case: { $lte: ["$outstanding", 0] }, then: "complete" },
                  { case: { $gt:  ["$total_paid",  0] }, then: "partial"  },
                ],
                default: "pending",
              },
            },
          },
        },
      ],
      { new: true }
    );

    if (!updated) {
      const exists = await Invoice.exists({ _id: id });
      if (!exists) {
        return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
      }
      const inv = await Invoice.findById(id, "payment_status outstanding").lean() as any;
      if (inv?.payment_status === "complete") {
        return NextResponse.json({ success: false, error: "Invoice is already fully paid" }, { status: 400 });
      }
      return NextResponse.json(
        { success: false, error: `Payment amount exceeds outstanding balance (${inv?.outstanding ?? 0})` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[payments POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to record payment" }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/invoices/[id]/payments", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json({ success: false, error: "paymentId is required" }, { status: 400 });
    }

    const updated = await Invoice.findOneAndUpdate(
      { _id: id },
      [
        {
          $set: {
            payments: {
              $filter: { input: "$payments", as: "p", cond: { $ne: [{ $toString: "$$p._id" }, paymentId] } },
            },
          },
        },
        {
          $set: {
            total_paid: {
              $add: [
                { $reduce: { input: "$payments", initialValue: 0, in: { $add: ["$$value", "$$this.amount"] } } },
                { $ifNull: ["$advance", 0] },
              ],
            },
          },
        },
        {
          $set: {
            outstanding: { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
            balance:     { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
          },
        },
        {
          $set: {
            payment_status: {
              $switch: {
                branches: [
                  { case: { $lte: ["$outstanding", 0] }, then: "complete" },
                  { case: { $gt:  ["$total_paid",  0] }, then: "partial"  },
                ],
                default: "pending",
              },
            },
          },
        },
      ],
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[payments DELETE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
