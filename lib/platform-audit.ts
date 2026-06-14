import { connectDB } from "@/lib/mongoose";
import PlatformAuditLog from "@/models/PlatformAuditLog";
import { getClientIP } from "@/lib/rate-limit";

export interface RecordPlatformAuditOpts {
  req: Request;
  platformAdminId: string;
  actorEmail: string;
  /** Dotted action key, e.g. "subscription.suspend", "plan.update". */
  action: string;
  targetOrgId?: string;
  targetOrgName?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Write a platform audit entry for a cross-tenant mutation. Awaited (so it
 * completes before the response) but, like the tenant `recordAudit`, never throws
 * — a failed audit line must not turn a successful mutation into a 500.
 * `PlatformAuditLog` is global (no tenant plugin), so this is safe in any context.
 */
export async function recordPlatformAudit(opts: RecordPlatformAuditOpts): Promise<void> {
  try {
    await connectDB();
    await PlatformAuditLog.create({
      actor_platform_admin_id: opts.platformAdminId,
      actor_email: opts.actorEmail,
      action: opts.action,
      target_org_id: opts.targetOrgId,
      target_org_name: opts.targetOrgName ?? "",
      before: (opts.before as Record<string, unknown> | undefined) ?? null,
      after: (opts.after as Record<string, unknown> | undefined) ?? null,
      ip: getClientIP(opts.req),
    });
  } catch (err) {
    console.error("[platform-audit] write failed:", err);
  }
}
