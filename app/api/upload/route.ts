import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTenant } from "@/lib/with-tenant";
import { resolveCloudinaryConfig, uploadToCloudinary, CLOUDINARY_NOT_CONFIGURED } from "@/lib/cloudinary";
import { CLOUDINARY_FEATURES, cloudinaryFolder, isCloudinaryFeature, sanitizeSegment } from "@/lib/cloudinary-folders";

export const POST = withTenant("POST /api/upload", async (req: NextRequest) => {
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

    if (!file) return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });

    // The folder is derived server-side from a validated feature key (never a raw
    // client-supplied path) so uploads can't escape the Quotesphere/ parent.
    const feature = formData.get("feature");
    if (!isCloudinaryFeature(feature)) {
      return NextResponse.json({ success: false, error: "Invalid or missing upload feature" }, { status: 400 });
    }
    // Owner-scoped features key the subfolder off the session user; record-scoped
    // features require the caller to pass the owning record's id.
    let recordId = userId;
    if (CLOUDINARY_FEATURES[feature].scope === "record") {
      recordId = sanitizeSegment(formData.get("recordId") as string | null);
      if (!recordId) {
        return NextResponse.json({ success: false, error: "Missing recordId for this upload" }, { status: 400 });
      }
    }
    const folder = cloudinaryFolder(feature, recordId);

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
