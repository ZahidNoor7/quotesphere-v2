import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { BUILT_IN_DESIGNS } from "@/lib/document-designs";
import { withLog } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";

async function clearDefaultsForType(userId: string, docType: string) {
  await Settings.updateOne(
    { user_id: userId, "documentDesigns.0": { $exists: true } },
    { $set: { "documentDesigns.$[elem].isDefault": false } },
    { arrayFilters: [{ "elem.type": { $in: [docType, "all"] } }] }
  );
}

export const PUT = withLog("PUT /api/settings/document-designs/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
    void recordAudit({ req, session, action: "update", resource: "settings", resource_id: (session.user as any).id, resource_label: `Document design updated: ${design?.name ?? id}` });
    return NextResponse.json({ success: true, data: design });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const DELETE = withLog("DELETE /api/settings/document-designs/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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

    void recordAudit({ req, session, action: "delete", resource: "settings", resource_id: (session.user as any).id, resource_label: `Document design deleted: ${id}` });
    return NextResponse.json({ success: true, message: "Design deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const PATCH = withLog("PATCH /api/settings/document-designs/[id]", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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
      await Settings.findOneAndUpdate(
        { user_id: userId },
        { $set: { [lastUsedKey]: id } },
        { upsert: true }
      );
      await clearDefaultsForType(userId, type);
    } else {
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
});
