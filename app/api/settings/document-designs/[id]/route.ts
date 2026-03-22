import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { BUILT_IN_DESIGNS } from "@/lib/document-designs";

/** PUT /api/settings/document-designs/[id]
 *  Updates a user design by id.
 *  Body: { name?, type?, config?, isDefault? }
 *  - If isDefault=true, unsets all other isDefault for the same type first.
 *  - Built-in design IDs are not editable; returns 403.
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

    // If setting as default, unset existing defaults for this type
    if (isDefault === true) {
      const docType = type ?? (await Settings.findOne({ user_id: userId, "documentDesigns.id": id }).lean() as any)
        ?.documentDesigns?.find((d: any) => d.id === id)?.type ?? "all";

      await Settings.findOneAndUpdate(
        { user_id: userId },
        { $set: { "documentDesigns.$[elem].isDefault": false } },
        { arrayFilters: [{ "elem.type": { $in: [docType, "all"] } }] }
      );
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
 *  For built-in designs, this stores an override preference in the user's settings.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const { id } = await params;

    await connectDB();
    const body = await req.json();
    const { type } = body; // "invoice" | "quotation" | "receipt"
    if (!type) return NextResponse.json({ success: false, error: "type is required" }, { status: 400 });

    const isBuiltIn = BUILT_IN_DESIGNS.some(d => d.id === id);

    if (isBuiltIn) {
      // For built-ins, store the selection in lastUsed
      const lastUsedKey = type === "invoice" ? "lastUsed.invoiceDesignId"
        : type === "quotation" ? "lastUsed.quotationDesignId"
        : "lastUsed.receiptDesignId";

      // Unset all user-design defaults for this type
      await Settings.findOneAndUpdate(
        { user_id: userId },
        {
          $set: {
            [lastUsedKey]: id,
            "documentDesigns.$[elem].isDefault": false,
          }
        },
        { arrayFilters: [{ "elem.type": { $in: [type, "all"] } }], upsert: true }
      );
    } else {
      // Unset all defaults for this type across user designs
      await Settings.findOneAndUpdate(
        { user_id: userId },
        { $set: { "documentDesigns.$[elem].isDefault": false } },
        { arrayFilters: [{ "elem.type": { $in: [type, "all"] } }] }
      );
      // Set this design as default
      await Settings.findOneAndUpdate(
        { user_id: userId },
        { $set: { "documentDesigns.$[elem2].isDefault": true } },
        { arrayFilters: [{ "elem2.id": id }] }
      );
      // Also update lastUsed to this design
      const lastUsedKey = type === "invoice" ? "lastUsed.invoiceDesignId"
        : type === "quotation" ? "lastUsed.quotationDesignId"
        : "lastUsed.receiptDesignId";
      await Settings.findOneAndUpdate({ user_id: userId }, { $set: { [lastUsedKey]: id } });
    }

    return NextResponse.json({ success: true, message: `Design set as default for ${type}` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
