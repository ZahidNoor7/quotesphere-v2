import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { enterOrg } from "@/lib/tenant-context";
import { withLog } from "@/lib/logger";
import { testCloudinaryConnection } from "@/lib/cloudinary";
import { resolveSubmittedSecret } from "@/lib/settings-secrets";

// Validate Cloudinary credentials. Tests the posted config, but resolves
// write-only secrets (masked on read) against the stored Settings so a saved
// integration can be re-tested without re-typing the key.
export const POST = withLog("POST /api/cloudinary/test", async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const orgId = (session.user as { org_id?: string }).org_id;

  const body = await req.json().catch(() => ({}));
  const cloudName = String(body?.cloudName ?? "").trim();
  let apiKey = String(body?.apiKey ?? "").trim();
  let apiSecret = String(body?.apiSecret ?? "").trim();

  if (orgId) {
    enterOrg(orgId);
    await connectDB();
    const stored = (await Settings.findOne({}).select("integrations.cloudinary").lean()) as any;
    const c = stored?.integrations?.cloudinary ?? {};
    apiKey = resolveSubmittedSecret(apiKey, c.apiKey) ?? "";
    apiSecret = resolveSubmittedSecret(apiSecret, c.apiSecret) ?? "";
  }

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
