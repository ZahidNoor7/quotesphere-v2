import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any */

const rowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().max(100).optional(),
  default_price: z.coerce.number().min(0).optional(),
  stock_qty: z.coerce.number().min(0).optional(),
  low_stock_threshold: z.coerce.number().min(0).optional(),
  category: z.string().max(100).optional(),
  unit: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
  currency: z.string().max(10).optional(),
});

const bulkSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(500),
  skipDupes: z.boolean().optional().default(true),
});

const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, "_");
const ALIASES: Record<string, string> = {
  name: "name", product_name: "name", title: "name", item: "name",
  sku: "sku", code: "sku", item_code: "sku", barcode: "sku",
  price: "default_price", default_price: "default_price", unit_price: "default_price", rate: "default_price", selling_price: "default_price",
  stock: "stock_qty", stock_qty: "stock_qty", stock_quantity: "stock_qty", quantity: "stock_qty", qty: "stock_qty",
  low_stock: "low_stock_threshold", low_stock_threshold: "low_stock_threshold", reorder_level: "low_stock_threshold",
  category: "category", type: "category",
  unit: "unit", uom: "unit",
  description: "description", desc: "description", details: "description",
  currency: "currency",
};

export const POST = withTenant("POST /api/products/bulk", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const parsed = bulkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }
    const { rows, skipDupes } = parsed.data;

    const results: { row: number; status: "created" | "skipped" | "error"; name?: string; reason?: string }[] = [];
    let created = 0, skipped = 0, errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(rows[i])) {
        const alias = ALIASES[norm(k)];
        const val = v?.trim() ?? "";
        if (alias && val !== "") mapped[alias] = val;
      }

      const rowParsed = rowSchema.safeParse(mapped);
      if (!rowParsed.success) {
        errors++;
        results.push({ row: i + 1, status: "error", name: mapped.name, reason: Object.values(z.flattenError(rowParsed.error).fieldErrors).flat().join(", ") });
        continue;
      }
      const data = rowParsed.data;

      if (skipDupes) {
        const dupeQuery = data.sku ? { sku: data.sku } : { name: data.name };
        if (await Product.findOne(dupeQuery).select("_id").lean()) {
          skipped++;
          results.push({ row: i + 1, status: "skipped", name: data.name, reason: data.sku ? "Duplicate SKU" : "Duplicate name" });
          continue;
        }
      }

      try {
        await Product.create(data);
        created++;
        results.push({ row: i + 1, status: "created", name: data.name });
      } catch (err: any) {
        errors++;
        results.push({ row: i + 1, status: "error", name: data.name, reason: err.message });
      }
    }

    if (created > 0) {
      void recordAudit({ req, session, action: "create", resource: "product", resource_id: "bulk", resource_label: `Bulk import: ${created} created, ${skipped} skipped, ${errors} errors` });
    }
    return NextResponse.json({ success: true, data: { created, skipped, errors, total: rows.length, results } });
  } catch (err: any) {
    console.error("[products/bulk POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Bulk import failed" }, { status: 500 });
  }
});
