import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import AssistantConversation from "@/models/AssistantConversation";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/assistant/conversations", async (_req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;

    await connectDB();
    const data = await AssistantConversation.find({ user_id: userId }, "title createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[assistant conversations GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load conversations" }, { status: 500 });
  }
});
