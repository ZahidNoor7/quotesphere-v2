import { connectDB } from "@/lib/mongoose";
import AuditLog, { type AuditAction, type AuditResource } from "@/models/AuditLog";
import { getClientIP } from "@/lib/rate-limit";

// Keys to strip from before/after snapshots to keep logs lean
const OMIT_KEYS = new Set([
  "__v", "payments", "items", "attachments", "bill_images",
  "project_notes", "milestones", "documentDesigns",
  "rateSnapshot", "currencyRates", "integrations",
]);

function sanitize(doc: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!doc) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (OMIT_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export interface RecordAuditOpts {
  req:             Request;
  session:         any;
  action:          AuditAction;
  resource:        AuditResource;
  resource_id:     string;
  resource_label?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before?:         any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after?:          any;
}

/**
 * Write an audit log entry. Always fire-and-forget — never throws.
 * Call with `.catch(() => {})` or just `void recordAudit(...)`.
 */
export async function recordAudit(opts: RecordAuditOpts): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      user_id:        opts.session?.user?.id ?? (opts.session?.user as any)?.id ?? "system",
      user_name:      opts.session?.user?.name  ?? "",
      user_email:     opts.session?.user?.email ?? "",
      action:         opts.action,
      resource:       opts.resource,
      resource_id:    opts.resource_id,
      resource_label: opts.resource_label ?? "",
      before:         sanitize(opts.before ?? null),
      after:          sanitize(opts.after  ?? null),
      ip:             getClientIP(opts.req),
    });
  } catch (err) {
    // Audit failures must never break the main flow
    console.error("[audit] write failed:", err);
  }
}

