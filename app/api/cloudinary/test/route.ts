import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withLog } from "@/lib/logger";
import { testCloudinaryConnection } from "@/lib/cloudinary";

// Validate Cloudinary credentials without saving them. Uses only the posted
// config (no Settings/tenant data), so it needs auth but no tenant context.
export const POST = withLog("POST /api/cloudinary/test", async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const cloudName = String(body?.cloudName ?? "").trim();
  const apiKey = String(body?.apiKey ?? "").trim();
  const apiSecret = String(body?.apiSecret ?? "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { success: false, error: "Cloud name, API key and API secret are all required." },
      { status: 400 },
    );
  }

  const result = await testCloudinaryConnection({ cloudName, apiKey, apiSecret });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error || "Couldn't connect — check your credentials." },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true, message: `Connected to Cloudinary "${cloudName}".` });
});
