import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { BUILT_IN_DESIGNS } from "@/lib/document-designs";

/** GET /api/settings/document-designs
 *  Returns built-in designs merged with user's saved designs.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    await connectDB();
    const settings = await Settings.findOne({ user_id: userId }).lean();
    const userDesigns = (settings as any)?.documentDesigns ?? [];
    return NextResponse.json({ success: true, data: { builtIn: BUILT_IN_DESIGNS, user: userDesigns } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** POST /api/settings/document-designs
 *  Creates a new custom design and appends it to the user's documentDesigns array.
 *  Body: { name, type, config, isDefault? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    await connectDB();

    const body = await req.json();
    const { name, type, config, isDefault = false } = body;

    if (!name || !type || !config) {
      return NextResponse.json({ success: false, error: "name, type, and config are required" }, { status: 400 });
    }

    const newDesign = { id: crypto.randomUUID().slice(0, 10), name, type, isDefault: false, config };

    // If this should be default, unset all other defaults for this type first
    if (isDefault) {
      await Settings.findOneAndUpdate(
        { user_id: userId },
        { $set: { "documentDesigns.$[elem].isDefault": false } },
        { arrayFilters: [{ "elem.type": { $in: [type, "all"] } }], upsert: true }
      );
      newDesign.isDefault = true;
    }

    const updated = await Settings.findOneAndUpdate(
      { user_id: userId },
      { $push: { documentDesigns: newDesign } },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ success: true, data: newDesign });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
