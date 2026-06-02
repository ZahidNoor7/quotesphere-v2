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
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
