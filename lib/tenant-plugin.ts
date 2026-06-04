import mongoose, { Schema } from "mongoose";
import { resolveOrgScope } from "@/lib/tenant-context";

/** The owner field added to every tenant-scoped model. */
export const ORG_FIELD = "org_id";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mongoose plugin that enforces per-organization data isolation. Applied to a
 * schema it:
 *   1. adds an indexed, required `org_id` (ref `Organization`),
 *   2. injects `{ org_id }` into every find / count / update / delete query
 *      (findById* map onto findOne* and are covered),
 *   3. prepends `{ $match: { org_id } }` to every aggregation,
 *   4. stamps `org_id` onto new documents on `save` and `insertMany`,
 * reading the current org from the AsyncLocalStorage tenant context.
 *
 * It is **fail-closed**: a query with no tenant context throws (see
 * `resolveOrgScope`) rather than returning another org's data. System paths
 * that must span orgs run inside `bypassTenant()`.
 */
export function tenantScope(schema: Schema, opts?: { required?: boolean; unique?: boolean }): void {
  // `required` defaults to true. AuditLog opts out because audit entries are also
  // written from system paths (cron/webhook) that run in bypass mode with no org.
  // `unique` (e.g. Settings) enforces exactly one document per org.
  const required = opts?.required ?? true;
  const unique = opts?.unique ?? false;
  schema.add({
    [ORG_FIELD]: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required,
      unique,
      index: true,
    },
  });

  // Query middleware — find, findOne, findOneAndUpdate/Delete/Replace, count,
  // countDocuments, updateOne/Many, deleteOne/Many, replaceOne.
  function queryHook(this: mongoose.Query<any, any>) {
    const orgId = resolveOrgScope(this.model?.modelName ?? "Query");
    if (orgId) this.where({ [ORG_FIELD]: orgId });
  }
  schema.pre(/^(find|count|update|delete|replace)/ as any, queryHook as any);

  // Aggregations — prepend an org $match (aggregate does not auto-cast, so build
  // an explicit ObjectId).
  schema.pre("aggregate", function (this: mongoose.Aggregate<any>) {
    const orgId = resolveOrgScope("aggregate");
    if (orgId) {
      this.pipeline().unshift({ $match: { [ORG_FIELD]: new mongoose.Types.ObjectId(orgId) } });
    }
  });

  // Stamp org on new documents. Must run on `validate` (not `save`) because
  // Mongoose enforces `required` during validation, which happens BEFORE the
  // save hooks — stamping in pre('save') would be too late and fail validation.
  schema.pre("validate", function (this: any) {
    if (this.isNew && this[ORG_FIELD] == null) {
      const orgId = resolveOrgScope(this.constructor?.modelName ?? "validate");
      if (orgId) this[ORG_FIELD] = orgId;
    }
  });

  (schema.pre as any)("insertMany", function (next: (err?: Error) => void, docs: any[]) {
    try {
      const orgId = resolveOrgScope("insertMany");
      if (orgId) for (const d of docs) if (d[ORG_FIELD] == null) d[ORG_FIELD] = orgId;
      next();
    } catch (err) {
      next(err as Error);
    }
  });
}
