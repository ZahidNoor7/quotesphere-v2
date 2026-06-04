import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { withTenant } from "@/lib/with-tenant";
import { recordAudit } from "@/lib/audit";
import { emailConfiguredFrom } from "@/lib/email";

// Keys that change silently on every interaction — skip audit logging for these-only updates
const SILENT_KEYS = new Set(["appearance", "lastUsed", "enabledCurrencies", "currencyRates", "integrations"]);

/** Flattens nested objects into dot-notation keys for MongoDB $set deep merge. */
function flattenObject(obj: Record<string, any>, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(result, flattenObject(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

export const GET = withTenant("GET /api/settings", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    await connectDB();
    let settings = await Settings.findOne({}).lean();
    if (!settings) {
      settings = (await Settings.create({})).toObject();
    }
    // Surface whether email is configured (in-app integration OR env) so the UI
    // can gate the reminder email channel. Boolean only; never exposes the key.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailCfg = (settings as any)?.integrations?.email;
    const emailConfigured = emailConfiguredFrom(emailCfg) || !!process.env.RESEND_API_KEY;

    // Cloudinary + currency now live entirely in-app — surface boolean "configured"
    // flags (never the secrets) so the UI can gate features and link to setup.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (settings as any)?.integrations?.cloudinary;
    const cloudinaryConfigured = !!(cl?.enabled && cl.cloudName && cl.apiKey && cl.apiSecret);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currencyConfigured = !!(settings as any)?.integrations?.currencyApi?.enabled;

    return NextResponse.json({ success: true, data: { ...settings, emailConfigured, cloudinaryConfigured, currencyConfigured } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch settings" }, { status: 500 });
  }
});

export const PUT = withTenant("PUT /api/settings", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    await connectDB();
    const body = await req.json();

    // Determine whether this update touches meaningful business fields
    const touchedKeys = Object.keys(body);
    const isSilentUpdate = touchedKeys.every(k => SILENT_KEYS.has(k));

    const before = isSilentUpdate ? null : await Settings.findOne({}).lean();

    const $set = flattenObject(body);
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    if (!isSilentUpdate) {
      void recordAudit({
        req, session,
        action: "update",
        resource: "settings",
        resource_id: userId,
        resource_label: "Company settings",
        before,
        after: settings,
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
