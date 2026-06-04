import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import AssistantConversation from "@/models/AssistantConversation";
import { withTenant } from "@/lib/with-tenant";

const patchSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.pinned !== undefined, { message: "Nothing to update" });

export const GET = withTenant(
  "GET /api/assistant/conversations/[id]",
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      const userId = (session.user as { id?: string }).id;

      await connectDB();
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

      const data = await AssistantConversation.findOne({ _id: id, user_id: userId }).lean();
      if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true, data });
    } catch (err) {
      console.error("[assistant conversation GET]", err);
      return NextResponse.json({ success: false, error: "Failed to load conversation" }, { status: 500 });
    }
  }
);

export const PATCH = withTenant(
  "PATCH /api/assistant/conversations/[id]",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      const userId = (session.user as { id?: string }).id;

      await connectDB();
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

      const parsed = patchSchema.safeParse(await req.json());
      if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid update" }, { status: 400 });

      const $set: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) $set.title = parsed.data.title;
      if (parsed.data.pinned !== undefined) $set.pinned = parsed.data.pinned;

      const data = await AssistantConversation.findOneAndUpdate(
        { _id: id, user_id: userId },
        { $set },
        // Don't bump updatedAt for rename/pin — these aren't conversation activity.
        { new: true, projection: "title pinned createdAt updatedAt", timestamps: false }
      ).lean();
      if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true, data });
    } catch (err) {
      console.error("[assistant conversation PATCH]", err);
      return NextResponse.json({ success: false, error: "Failed to rename conversation" }, { status: 500 });
    }
  }
);

export const DELETE = withTenant(
  "DELETE /api/assistant/conversations/[id]",
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      const userId = (session.user as { id?: string }).id;

      await connectDB();
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

      const res = await AssistantConversation.deleteOne({ _id: id, user_id: userId });
      if (res.deletedCount === 0) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[assistant conversation DELETE]", err);
      return NextResponse.json({ success: false, error: "Failed to delete conversation" }, { status: 500 });
    }
  }
);
