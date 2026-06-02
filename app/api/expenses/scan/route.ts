import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { withLog } from "@/lib/logger";
import { requireRole } from "@/lib/rbac";
import { extractBillFromImage } from "@/lib/assistant/vision";
import type { AiAssistantConfig } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const schema = z.object({ imageUrl: z.url() });

/**
 * Scan a vendor-bill image with the configured AI provider and return a
 * structured expense draft. Does NOT persist — the user reviews then saves
 * through POST /api/expenses.
 */
export const POST = withLog("POST /api/expenses/scan", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method); // create permission
    if (denied) return denied;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: "A valid imageUrl is required." }, { status: 400 });

    await connectDB();
    // Use the SAME provider the assistant is configured with (per-user settings),
    // exactly like the chat/test routes — not a separate config.
    const userId = (session.user as { id?: string })?.id;
    const settings = (await Settings.findOne({ user_id: userId }).lean()) as any;
    const cfg = settings?.integrations?.aiAssistant as AiAssistantConfig | undefined;

    const draft = await extractBillFromImage(cfg, parsed.data.imageUrl);
    const items = draft.items.map((it, i) => ({
      id: i + 1,
      name: it.name,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));

    return NextResponse.json({
      success: true,
      data: {
        vendor_name: draft.vendor_name ?? "",
        bill_date: draft.bill_date || "",
        currency: draft.currency || "PKR",
        tax: draft.tax ?? 0,
        items,
        imageUrl: parsed.data.imageUrl,
      },
    });
  } catch (err: any) {
    console.error("[expenses/scan POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Scan failed" }, { status: 500 });
  }
});
