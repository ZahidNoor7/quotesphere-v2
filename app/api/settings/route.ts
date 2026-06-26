import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { emailConfiguredFrom } from "@/lib/email";
import { maskSecrets, isSecretLeaf, isUnchangedSecret } from "@/lib/settings-secrets";

// Keys that change silently on every interaction — skip audit logging for these-only updates
const SILENT_KEYS = new Set(["appearance", "lastUsed", "enabledCurrencies", "currencyRates", "integrations"]);

// Display/cache preferences that any member may update (org-wide, non-sensitive).
// NOTE: `integrations` is deliberately EXCLUDED — secret writes require admin.
const PREFERENCE_KEYS = new Set(["appearance", "lastUsed", "enabledCurrencies", "currencyRates", "default_currency"]);

// Never accepted from the request body (identity / framework-managed).
const IDENTITY_KEYS = new Set(["org_id", "_id", "__v", "createdAt", "updatedAt", "id", "user_id"]);

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

    // Strip credentials before they ever leave the server — integration secrets
    // are write-only. The *Configured booleans above tell the UI what is set.
    const safe = maskSecrets(settings);
    return NextResponse.json({ success: true, data: { ...safe, emailConfigured, cloudinaryConfigured, currencyConfigured } });
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
    // Display/cache preferences any member may persist (theme, sidebar, last-used,
    // currency display). Everything else — company info AND integration secrets —
    // is admin-only. (`integrations` is NOT a preference, so secret writes stay gated.)
    const adminOnly = !touchedKeys.every(k => PREFERENCE_KEYS.has(k));
    if (adminOnly) {
      const denied = requireRole(session, req.method, "settings");
      if (denied) return denied;
    }
    const isSilentUpdate = touchedKeys.every(k => SILENT_KEYS.has(k));

    const before = isSilentUpdate ? null : await Settings.findOne({}).lean();

    const $set = flattenObject(body);
    // Sanitize the flattened update: never accept identity keys (org_id is also
    // stripped by the tenant plugin), and treat a masked/blank secret as
    // "unchanged" so a write-only field the client echoed back can't wipe the
    // stored credential.
    for (const key of Object.keys($set)) {
      const leaf = key.split(".").pop() ?? key;
      if (IDENTITY_KEYS.has(leaf) || IDENTITY_KEYS.has(key)) { delete $set[key]; continue; }
      if (isSecretLeaf(leaf) && isUnchangedSecret($set[key])) delete $set[key];
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
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

    // Mask secrets in the echo-back too — the PUT response must never carry
    // plaintext credentials (the GET masks; this is the matching write-side mask).
    return NextResponse.json({ success: true, data: maskSecrets(settings) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
  // writeRole "none": this handler does its OWN role logic — display preferences
  // are open to any member, while company config / integration secrets require
  // admin (see the PREFERENCE_KEYS check above).
}, { writeRole: "none" });
