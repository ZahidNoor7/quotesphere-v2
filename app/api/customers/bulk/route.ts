import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Customer from "@/models/Customer";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";

const rowSchema = z.object({
  name:     z.string().min(1, "Name is required").max(200),
  phone_no: z.string().min(1, "Phone is required").max(50),
  email:    z.email().optional().or(z.literal("")).or(z.undefined()),
  company:  z.string().max(200).optional(),
  address:  z.string().max(500).optional(),
  notes:    z.string().max(2000).optional(),
});

const bulkSchema = z.object({
  rows:      z.array(z.record(z.string(), z.string())).min(1).max(500),
  skipDupes: z.boolean().optional().default(true),
});

export const POST = withTenant("POST /api/customers/bulk", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    await connectDB();
    const body = await req.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }

    const { rows, skipDupes } = parsed.data;

    // Normalise column names (case-insensitive, trim whitespace)
    const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, "_");
    const ALIASES: Record<string, string> = {
      name: "name", full_name: "name", customer_name: "name",
      phone: "phone_no", phone_no: "phone_no", mobile: "phone_no", tel: "phone_no",
      email: "email", email_address: "email",
      company: "company", company_name: "company", organisation: "company", organization: "company",
      address: "address", location: "address",
      notes: "notes", note: "notes", comments: "notes",
    };

    const results: { row: number; status: "created" | "skipped" | "error"; name?: string; reason?: string }[] = [];
    let created = 0;
    let skipped = 0;
    let errors  = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        const alias = ALIASES[norm(k)];
        if (alias) mapped[alias] = v?.trim() ?? "";
      }

      const rowParsed = rowSchema.safeParse(mapped);
      if (!rowParsed.success) {
        errors++;
        results.push({ row: i + 1, status: "error", name: mapped.name, reason: Object.values(z.flattenError(rowParsed.error).fieldErrors).flat().join(", ") });
        continue;
      }

      const { name, phone_no, email, company, address, notes } = rowParsed.data;

      if (skipDupes) {
        const exists = await Customer.findOne({ phone_no }).select("_id").lean();
        if (exists) {
          skipped++;
          results.push({ row: i + 1, status: "skipped", name, reason: "Duplicate phone number" });
          continue;
        }
      }

      try {
        await Customer.create({ name, phone_no, email: email || undefined, company, address, notes, status: true });
        created++;
        results.push({ row: i + 1, status: "created", name });
      } catch (err: any) {
        errors++;
        results.push({ row: i + 1, status: "error", name, reason: err.message });
      }
    }

    if (created > 0) {
      void recordAudit({ req, session, action: "create", resource: "customer", resource_id: "bulk", resource_label: `Bulk import: ${created} created, ${skipped} skipped, ${errors} errors` });
    }
    return NextResponse.json({ success: true, data: { created, skipped, errors, total: rows.length, results } });
  } catch (err: any) {
    console.error("[customers/bulk POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Bulk import failed" }, { status: 500 });
  }
});
