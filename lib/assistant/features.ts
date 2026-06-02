// Client-safe (no server imports) — shared by the agent (tool gating + prompt)
// and the settings UI. Each feature maps to the tool names it unlocks.

export interface AssistantFeature {
  key: string;
  label: string;
  description: string;
  tools: string[];
}

export const ASSISTANT_FEATURES: AssistantFeature[] = [
  {
    key: "quotations",
    label: "Quotations",
    description: "Create, edit, convert and list quotations",
    tools: ["search_quotations", "get_quotation", "create_quotation", "update_quotation", "convert_quotation"],
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Create, edit and list invoices",
    tools: ["search_invoices", "get_invoice", "create_invoice", "update_invoice"],
  },
  {
    key: "payments",
    label: "Payments",
    description: "Record payments against invoices",
    tools: ["record_payment"],
  },
  {
    key: "customers",
    label: "Clients",
    description: "Look up and create customers",
    tools: ["list_customers", "create_customer", "create_customers"],
  },
  {
    key: "products",
    label: "Products",
    description: "List, create and edit products (pricing & stock)",
    tools: ["list_products", "create_product", "update_product", "create_products"],
  },
  {
    key: "services",
    label: "Services",
    description: "List, create and edit services",
    tools: ["list_services", "create_service", "update_service", "create_services"],
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "List and record expenses",
    tools: ["list_expenses", "create_expense"],
  },
  {
    key: "projects",
    label: "Projects",
    description: "List and create projects",
    tools: ["list_projects", "create_project"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Revenue, outstanding and totals summary (read-only)",
    tools: ["get_summary"],
  },
];

/** A feature is enabled unless explicitly set to false (default-on for existing configs). */
export function isFeatureEnabled(features: Record<string, boolean> | undefined, key: string): boolean {
  return features?.[key] !== false;
}

/** The set of tool names the assistant may use given the feature toggles. */
export function enabledToolSet(features: Record<string, boolean> | undefined): Set<string> {
  const set = new Set<string>();
  for (const f of ASSISTANT_FEATURES) {
    if (isFeatureEnabled(features, f.key)) for (const t of f.tools) set.add(t);
  }
  return set;
}

/** Labels of disabled features — surfaced to the model so it declines them. */
export function disabledFeatureLabels(features: Record<string, boolean> | undefined): string[] {
  return ASSISTANT_FEATURES.filter((f) => !isFeatureEnabled(features, f.key)).map((f) => f.label);
}
