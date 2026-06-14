import type { FeatureKey } from "@/types";

/**
 * Canonical catalog of app features. This is the single source of truth for what
 * a Plan may grant and how each module/capability maps to a route. Pure (no DB /
 * no env) so it is safe to import on both client and server.
 *
 * Feature availability is a PER-TENANT plan setting (resolved from the tenant's
 * subscription) — never an env flag. See lib/entitlements/resolve.ts.
 */
export type FeatureCategory =
  | "core" | "sales" | "catalog" | "admin" | "communication" | "ai";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  category: FeatureCategory;
  /** "module" = a gateable top-level route; "capability" = a cross-cutting action. */
  kind: "module" | "capability";
  /** Primary route for module features (drives the sidebar + route→feature map). */
  route?: string;
  /** Core features are always granted and never gated. */
  alwaysOn?: boolean;
}

export const FEATURES: FeatureDef[] = [
  // ── Core (always-on, never gated) ──
  { key: "dashboard", label: "Dashboard", description: "Business overview and KPIs", category: "core", kind: "module", route: "/dashboard", alwaysOn: true },
  { key: "settings",  label: "Settings",  description: "Company, billing and app settings", category: "core", kind: "module", route: "/settings", alwaysOn: true },
  { key: "team",      label: "Team",      description: "Invite and manage members", category: "core", kind: "module", route: "/team", alwaysOn: true },
  { key: "docs",      label: "Help & Guides", description: "Documentation and guides", category: "core", kind: "module", route: "/docs", alwaysOn: true },

  // ── Sales ──
  { key: "quotations", label: "Quotations", description: "Create, send and convert quotations", category: "sales", kind: "module", route: "/quotations" },
  { key: "invoices",   label: "Invoices",   description: "Create, send and track invoices", category: "sales", kind: "module", route: "/invoices" },
  { key: "customers",  label: "Clients",    description: "Manage your customers", category: "sales", kind: "module", route: "/customers" },
  { key: "projects",   label: "Projects",   description: "Project tracking, milestones and time", category: "sales", kind: "module", route: "/projects" },
  { key: "expenses",   label: "Expenses",   description: "Track vendor bills and expenses", category: "sales", kind: "module", route: "/expenses" },

  // ── Catalog ──
  { key: "services", label: "Services", description: "Service catalog", category: "catalog", kind: "module", route: "/services" },
  { key: "products", label: "Products", description: "Product catalog and inventory", category: "catalog", kind: "module", route: "/products" },

  // ── Admin ──
  { key: "reports", label: "Reports", description: "Aging, profit & loss and more", category: "admin", kind: "module", route: "/reports" },
  { key: "payroll", label: "Payroll", description: "Employees, salary runs and payslips", category: "admin", kind: "module", route: "/payroll" },

  // ── Communication ──
  { key: "messaging", label: "Messaging (WhatsApp)", description: "WhatsApp inbox via 360dialog", category: "communication", kind: "module", route: "/messaging" },
  { key: "email",     label: "Email sending", description: "Send invoices and quotations by email", category: "communication", kind: "capability" },

  // ── AI ──
  { key: "ai_assistant", label: "AI Assistant", description: "Create and edit documents by chat", category: "ai", kind: "module", route: "/assistant" },
];

export const ALL_FEATURE_KEYS: FeatureKey[] = FEATURES.map((f) => f.key);
export const ALWAYS_ON_FEATURES: FeatureKey[] = FEATURES.filter((f) => f.alwaysOn).map((f) => f.key);
/** Features the platform owner can include/exclude in a plan (everything not always-on). */
export const GATEABLE_FEATURES: FeatureDef[] = FEATURES.filter((f) => !f.alwaysOn);
export const GATEABLE_FEATURE_KEYS: FeatureKey[] = GATEABLE_FEATURES.map((f) => f.key);

const FEATURE_BY_KEY = new Map<string, FeatureDef>(FEATURES.map((f) => [f.key, f]));

export function getFeatureDef(key: string): FeatureDef | undefined {
  return FEATURE_BY_KEY.get(key);
}

export function isAlwaysOn(key: string): boolean {
  return !!FEATURE_BY_KEY.get(key)?.alwaysOn;
}

/** Map a pathname (e.g. "/invoices/123") to its gating feature key, or null. */
export function featureForRoute(pathname: string): FeatureKey | null {
  for (const f of FEATURES) {
    if (!f.route) continue;
    if (pathname === f.route || pathname.startsWith(f.route + "/")) return f.key;
  }
  return null;
}

/** Validate + dedupe an arbitrary feature list against the known catalog. */
export function sanitizeFeatureKeys(keys: unknown): FeatureKey[] {
  if (!Array.isArray(keys)) return [];
  const valid = new Set<string>(GATEABLE_FEATURE_KEYS);
  const out: FeatureKey[] = [];
  for (const k of keys) {
    if (typeof k === "string" && valid.has(k) && !out.includes(k as FeatureKey)) {
      out.push(k as FeatureKey);
    }
  }
  return out;
}

/**
 * Maps the first path segment of a tenant API route (/api/<segment>/…) to the
 * feature that gates it. Used by withTenant to reject writes to a module the
 * tenant's plan doesn't include. Segments not listed here are never feature-gated
 * (core/always-on: settings, team, profile, dashboard, export, upload, …).
 */
export const API_SEGMENT_FEATURE: Record<string, FeatureKey> = {
  invoices: "invoices",
  quotations: "quotations",
  customers: "customers",
  projects: "projects",
  "time-entries": "projects",
  expenses: "expenses",
  services: "services",
  products: "products",
  reports: "reports",
  payroll: "payroll",
  messaging: "messaging",
  whatsapp: "messaging",
  assistant: "ai_assistant",
  email: "email",
};
