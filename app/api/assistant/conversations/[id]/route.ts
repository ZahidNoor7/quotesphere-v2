import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import AssistantConversation from "@/models/AssistantConversation";
import { withLog } from "@/lib/logger";

const renameSchema = z.object({ title: z.string().min(1).max(120) });

export const GET = withLog(
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

export const PATCH = withLog(
  "PATCH /api/assistant/conversations/[id]",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      const userId = (session.user as { id?: string }).id;

      await connectDB();
      const { id } = await params;
      if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });

      const parsed = renameSchema.safeParse(await req.json());
      if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid title" }, { status: 400 });

      const data = await AssistantConversation.findOneAndUpdate(
        { _id: id, user_id: userId },
        { $set: { title: parsed.data.title } },
        { new: true, projection: "title createdAt updatedAt" }
      ).lean();
      if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true, data });
    } catch (err) {
      console.error("[assistant conversation PATCH]", err);
      return NextResponse.json({ success: false, error: "Failed to rename conversation" }, { status: 500 });
    }
  }
);

export const DELETE = withLog(
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
