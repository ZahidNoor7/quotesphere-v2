import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { withLog } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";

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

export const GET = withLog("GET /api/settings", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    await connectDB();
    let settings = await Settings.findOne({ user_id: userId }).lean();
    if (!settings) {
      settings = (await Settings.create({ user_id: userId })).toObject();
    }
    return NextResponse.json({ success: true, data: settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch settings" }, { status: 500 });
  }
});

export const PUT = withLog("PUT /api/settings", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    await connectDB();
    const body = await req.json();

    // Determine whether this update touches meaningful business fields
    const touchedKeys = Object.keys(body);
    const isSilentUpdate = touchedKeys.every(k => SILENT_KEYS.has(k));

    const before = isSilentUpdate ? null : await Settings.findOne({ user_id: userId }).lean();

    const $set = flattenObject(body);
    const settings = await Settings.findOneAndUpdate(
      { user_id: userId },
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
