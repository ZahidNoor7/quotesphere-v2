import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request tenant context. `orgId` is the organization that owns everything
 * the request may touch; `bypass` disables scoping for trusted system paths
 * (cron jobs, provider webhooks) that legitimately span organizations.
 */
export interface TenantStore {
  orgId: string | null;
  bypass: boolean;
}

// The AsyncLocalStorage instance MUST be a single process-wide singleton. Under
// Next.js dev (HMR / Turbopack) a module can be evaluated more than once — if the
// Mongoose model's tenant plugin and a route's runWithOrg ended up referencing
// different instances, a store set by one would be invisible to the other
// ("queried with no tenant context"). Pinning it to globalThis (same pattern as
// lib/db.ts) guarantees every reference resolves to the same store.
const globalForTenant = globalThis as typeof globalThis & {
  __qsTenant?: { storage: AsyncLocalStorage<TenantStore>; testDefaultOrg: string | null };
};
const tenant = (globalForTenant.__qsTenant ??= {
  storage: new AsyncLocalStorage<TenantStore>(),
  testDefaultOrg: null,
});
const storage = tenant.storage;

/** Run `fn` scoped to a single organization. Used by `withTenant`. */
export function runWithOrg<T>(orgId: string, fn: () => T): T {
  return storage.run({ orgId, bypass: false }, fn);
}

/**
 * Set the org context for the remainder of the current request's async
 * execution, without wrapping a callback. Convenience for plain
 * `export async function` route handlers (each request runs in its own async
 * context, so this is request-scoped). Prefer `withTenant` for new routes.
 */
export function enterOrg(orgId: string): void {
  storage.enterWith({ orgId, bypass: false });
}

/** Like `enterOrg`, but disables scoping (system paths: cron, webhooks). */
export function enterBypass(): void {
  storage.enterWith({ orgId: null, bypass: true });
}

/**
 * Run `fn` with tenant filtering DISABLED. Only for trusted system code (cron,
 * provider webhooks) that must read across orgs — always pair it with an
 * explicit org filter, or re-enter a single org via `runWithOrg` once resolved.
 */
export function bypassTenant<T>(fn: () => T): T {
  return storage.run({ orgId: null, bypass: true }, fn);
}

export function getTenantStore(): TenantStore | undefined {
  return storage.getStore();
}

// TEST ONLY: a fallback org used when no AsyncLocalStorage context is active, so
// unit tests can do direct model operations without wrapping each in runWithOrg.
// Ignored entirely outside NODE_ENV === "test", so production stays fail-closed.
export function setTestDefaultOrg(orgId: string | null): void {
  tenant.testDefaultOrg = orgId;
}

/**
 * Resolve the org filter for the tenant Mongoose plugin.
 *  - returns a string orgId → the query/document must be scoped to this org
 *  - returns null           → bypass mode, no scoping applied
 * Throws (fail-closed) if no context exists — i.e. a tenant model was used
 * outside `withTenant` / `runWithOrg` / `bypassTenant`. A throw here is a bug
 * (a forgotten wrapper), never a silent cross-tenant leak.
 */
export function resolveOrgScope(modelName: string): string | null {
  const store = storage.getStore();
  if (!store) {
    if (process.env.NODE_ENV === "test" && tenant.testDefaultOrg) return tenant.testDefaultOrg;
    throw new Error(
      `[tenant] "${modelName}" was queried with no tenant context. ` +
        `Wrap the route in withTenant(), or bypassTenant() for system paths.`,
    );
  }
  if (store.bypass) return null;
  if (!store.orgId) {
    throw new Error(`[tenant] "${modelName}" was queried but the tenant context has no orgId.`);
  }
  return store.orgId;
}
