import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withLog } from "@/lib/logger";
import { resolveCloudinaryConfig, uploadToCloudinary, CLOUDINARY_NOT_CONFIGURED } from "@/lib/cloudinary";

export const POST = withLog("POST /api/upload", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id ?? "";

    const cfg = await resolveCloudinaryConfig(userId);
    if (!cfg) {
      return NextResponse.json(
        { success: false, error: CLOUDINARY_NOT_CONFIGURED, code: "cloudinary_not_configured" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "quotesphere";

    if (!file) return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });

    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ success: false, error: `File too large. Max ${MAX_MB}MB.` }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const result = await uploadToCloudinary(cfg, dataUri, {
      folder,
      resource_type: "auto",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    return NextResponse.json({ success: true, data: { url: result.secure_url, public_id: result.public_id } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Upload failed" }, { status: 500 });
  }
});
