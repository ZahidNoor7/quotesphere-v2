import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { BUILT_IN_DESIGNS } from "@/lib/document-designs";

/** Helper: clears isDefault on user designs matching a doc type.
 *  Guards with "documentDesigns.0" existence check so MongoDB never
 *  throws "path must exist" when the array is missing or empty.
 */
async function clearDefaultsForType(userId: string, docType: string) {
  await Settings.updateOne(
    { user_id: userId, "documentDesigns.0": { $exists: true } },
    { $set: { "documentDesigns.$[elem].isDefault": false } },
    { arrayFilters: [{ "elem.type": { $in: [docType, "all"] } }] }
  );
}

/** PUT /api/settings/document-designs/[id]
 *  Updates a user design by id.
 *  Body: { name?, type?, config?, isDefault? }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const { id } = await params;

    if (BUILT_IN_DESIGNS.some(d => d.id === id)) {
      return NextResponse.json({ success: false, error: "Built-in designs cannot be modified" }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { name, type, config, isDefault } = body;

    // If setting as default, unset existing defaults for this type first
    if (isDefault === true) {
      const docType = type ?? (await Settings.findOne({ user_id: userId, "documentDesigns.id": id }).lean() as any)
        ?.documentDesigns?.find((d: any) => d.id === id)?.type ?? "all";
      await clearDefaultsForType(userId, docType);
    }

    const $set: Record<string, any> = {};
    if (name !== undefined) $set["documentDesigns.$[elem].name"] = name;
    if (type !== undefined) $set["documentDesigns.$[elem].type"] = type;
    if (config !== undefined) $set["documentDesigns.$[elem].config"] = config;
    if (isDefault !== undefined) $set["documentDesigns.$[elem].isDefault"] = isDefault;

    if (Object.keys($set).length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }

    await Settings.findOneAndUpdate(
      { user_id: userId },
      { $set },
      { arrayFilters: [{ "elem.id": id }] }
    );

    const updated = await Settings.findOne({ user_id: userId }).lean() as any;
    const design = updated?.documentDesigns?.find((d: any) => d.id === id);

    return NextResponse.json({ success: true, data: design });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** DELETE /api/settings/document-designs/[id]
 *  Removes a user design by id. Built-in designs cannot be deleted.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const { id } = await params;

    if (BUILT_IN_DESIGNS.some(d => d.id === id)) {
      return NextResponse.json({ success: false, error: "Built-in designs cannot be deleted" }, { status: 403 });
    }

    await connectDB();
    await Settings.findOneAndUpdate(
      { user_id: userId },
      { $pull: { documentDesigns: { id } } }
    );

    return NextResponse.json({ success: true, message: "Design deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/** PATCH /api/settings/document-designs/[id]
 *  Sets a design (built-in or user) as the default for a given document type.
 *  Body: { type: "invoice" | "quotation" | "receipt" }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const { id } = await params;

    await connectDB();
    const body = await req.json();
    const { type } = body;
    if (!type) return NextResponse.json({ success: false, error: "type is required" }, { status: 400 });

    const lastUsedKey = type === "invoice" ? "lastUsed.invoiceDesignId"
      : type === "quotation" ? "lastUsed.quotationDesignId"
      : "lastUsed.receiptDesignId";

    const isBuiltIn = BUILT_IN_DESIGNS.some(d => d.id === id);

    if (isBuiltIn) {
      // Step 1: Upsert settings doc + record lastUsed. No arrayFilters here.
      await Settings.findOneAndUpdate(
        { user_id: userId },
        { $set: { [lastUsedKey]: id } },
        { upsert: true }
      );
      // Step 2: Clear isDefault on user designs. Guarded — no-op if array missing.
      await clearDefaultsForType(userId, type);
    } else {
      // Clear all defaults for this type, then set the chosen design as default.
      await clearDefaultsForType(userId, type);

      await Settings.updateOne(
        { user_id: userId, "documentDesigns.0": { $exists: true } },
        { $set: { "documentDesigns.$[elem].isDefault": true } },
        { arrayFilters: [{ "elem.id": id }] }
      );

      await Settings.updateOne(
        { user_id: userId },
        { $set: { [lastUsedKey]: id } }
      );
    }

    return NextResponse.json({ success: true, message: `Design set as default for ${type}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
