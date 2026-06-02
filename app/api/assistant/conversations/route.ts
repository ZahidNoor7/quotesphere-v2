import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import AssistantConversation from "@/models/AssistantConversation";
import { withLog } from "@/lib/logger";

export const GET = withLog("GET /api/assistant/conversations", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;

    await connectDB();
    const search = (new URL(req.url).searchParams.get("search") || "").trim();
    const query: Record<string, unknown> = { user_id: userId };
    if (search) {
      // Escape regex metacharacters, then match the title or any message content.
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: rx }, { "messages.content": rx }];
    }

    // Pinned conversations first, then most-recent.
    const data = await AssistantConversation.find(query, "title pinned createdAt updatedAt")
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[assistant conversations GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load conversations" }, { status: 500 });
  }
});
