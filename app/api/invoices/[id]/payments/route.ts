import { NextRequest, NextResponse } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Build the payment subdocument up front so we can embed it inline
    const newPayment = {
      _id: new mongoose.Types.ObjectId(),
      date: date ? new Date(date) : new Date(),
      amount,
      method: method ?? "cash",
      reference: reference ?? undefined,
      note: note ?? undefined,
      createdAt: new Date(),
    };

    // Atomic read-check-write using a MongoDB aggregation pipeline update (4.2+).
    //
    // The match condition checks outstanding >= amount before applying any change,
    // so two concurrent requests can never both succeed for the same remaining balance.
    // Each pipeline stage sees the document as modified by the previous stage,
    // letting us push the payment and recalculate all derived fields in one round-trip.
    const updated = await Invoice.findOneAndUpdate(
      {
        _id: id,
        payment_status: { $ne: "complete" },
        // Small epsilon (0.001) handles floating-point edge cases where
        // outstanding is e.g. 0.0000001 due to prior arithmetic drift
        outstanding: { $gte: amount - 0.001 },
      },
      [
        // Stage 1 — push the new payment into the array
        {
          $set: {
            payments: { $concatArrays: ["$payments", [newPayment]] },
          },
        },
        // Stage 2 — recalculate total_paid from the updated payments + advance
        {
          $set: {
            total_paid: {
              $add: [
                {
                  $reduce: {
                    input: "$payments", // already includes newPayment from stage 1
                    initialValue: 0,
                    in: { $add: ["$$value", "$$this.amount"] },
                  },
                },
                { $ifNull: ["$advance", 0] },
              ],
            },
          },
        },
        // Stage 3 — derive outstanding and balance from the new total_paid
        {
          $set: {
            outstanding: { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
            balance:     { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
          },
        },
        // Stage 4 — update payment_status based on the new outstanding
        {
          $set: {
            payment_status: {
              $switch: {
                branches: [
                  { case: { $lte: ["$outstanding", 0] },  then: "complete" },
                  { case: { $gt:  ["$total_paid",  0] },  then: "partial"  },
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
      // Distinguish "invoice not found" from "balance check failed"
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
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Remove the payment atomically and recalculate derived fields in one operation
    const updated = await Invoice.findOneAndUpdate(
      { _id: id },
      [
        // Stage 1 — filter out the deleted payment
        {
          $set: {
            payments: {
              $filter: {
                input: "$payments",
                as: "p",
                cond: { $ne: [{ $toString: "$$p._id" }, paymentId] },
              },
            },
          },
        },
        // Stage 2 — recalculate total_paid
        {
          $set: {
            total_paid: {
              $add: [
                {
                  $reduce: {
                    input: "$payments",
                    initialValue: 0,
                    in: { $add: ["$$value", "$$this.amount"] },
                  },
                },
                { $ifNull: ["$advance", 0] },
              ],
            },
          },
        },
        // Stage 3 — derive outstanding and balance
        {
          $set: {
            outstanding: { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
            balance:     { $max: [0, { $subtract: ["$total_amount", "$total_paid"] }] },
          },
        },
        // Stage 4 — update payment_status
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
}
