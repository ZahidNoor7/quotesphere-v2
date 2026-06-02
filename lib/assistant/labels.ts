// Client-safe (no server imports) — shared by the agent loop and the chat UI.
export const TOOL_LABELS: Record<string, string> = {
  list_customers: "Looking up customers",
  list_products: "Looking up products",
  list_services: "Looking up services",
  search_quotations: "Searching quotations",
  get_quotation: "Loading quotation",
  search_invoices: "Searching invoices",
  get_invoice: "Loading invoice",
  create_quotation: "Preparing quotation",
  update_quotation: "Preparing quotation update",
  create_invoice: "Preparing invoice",
  update_invoice: "Preparing invoice update",
  convert_quotation: "Preparing conversion",
  record_payment: "Preparing payment",
  create_customer: "Preparing customer",
  create_customers: "Preparing customers",
  create_services: "Preparing services",
  list_expenses: "Looking up expenses",
  list_projects: "Looking up projects",
  get_summary: "Loading summary",
  create_product: "Preparing product",
  create_products: "Preparing products",
  update_product: "Preparing product update",
  create_service: "Preparing service",
  update_service: "Preparing service update",
  create_project: "Preparing project",
  create_expense: "Preparing expense",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
