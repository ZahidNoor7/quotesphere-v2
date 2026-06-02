import { z } from "zod";
import type { ProviderTool } from "./providers/types";

export type ToolKind = "read" | "write";
export type ToolOp = "read" | "create" | "update";

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema shown to the model. */
  inputSchema: Record<string, unknown>;
  /** Server-side validation (defense in depth on top of each route's own Zod). */
  zod: z.ZodTypeAny;
  kind: ToolKind;
  /** RBAC operation enforced by the executor before a write self-call. */
  op: ToolOp;
}

const CURRENCY_VALUES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;
const TAX_TYPE_VALUES = ["percentage", "value"] as const;
const PAYMENT_METHOD_VALUES = ["cash", "bank_transfer", "card", "online", "cheque"] as const;
const QUOTATION_STATUS_VALUES = ["draft", "pending", "approved", "rejected", "cancelled"] as const;
const INVOICE_STATUS_VALUES = ["draft", "issued", "cancelled"] as const;

// ─── Shared line item ─────────────────────────────────────────────────────────

const itemJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Line item description" },
    quantity: { type: "number", description: "Quantity (>= 0)" },
    price: { type: "number", description: "Unit price in the document currency (>= 0)" },
    product_id: {
      type: "string",
      description: "Catalog product id, only if this line is a known product (enables stock tracking on invoices)",
    },
  },
  required: ["name", "quantity", "price"],
  additionalProperties: false,
};

const itemZod = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  price: z.number().min(0),
  product_id: z.string().optional(),
});

// Shared editable document fields (JSON Schema fragments reused by create/update).
const sharedDocProps = {
  tax: { type: "number", description: "Tax amount or percentage (see tax_type). Default 0." },
  tax_type: { type: "string", enum: [...TAX_TYPE_VALUES], description: 'How tax is applied. Default "percentage".' },
  discount: { type: "number", description: "Discount amount in currency. Default 0." },
  delivery_charges: { type: "number", description: "Delivery/shipping charge in currency. Default 0." },
  currency: { type: "string", enum: [...CURRENCY_VALUES] },
  remarks: { type: "string", description: "Optional notes shown on the document." },
} as const;

const sharedDocZod = {
  tax: z.number().min(0).optional(),
  tax_type: z.enum(TAX_TYPE_VALUES).optional(),
  discount: z.number().min(0).optional(),
  delivery_charges: z.number().min(0).optional(),
  currency: z.enum(CURRENCY_VALUES).optional(),
  remarks: z.string().max(2000).optional(),
};

const customerRefProps = {
  customer_id: { type: "string", description: "The customer's id (from list_customers)." },
  customer_name: { type: "string", description: "The customer's display name (from list_customers)." },
  customer_phone: { type: "string" },
  customer_address: { type: "string" },
} as const;

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const ASSISTANT_TOOLS: ToolDef[] = [
  // ── Reads ──
  {
    name: "list_customers",
    description: "Search the customer directory by name, phone, company or email. Use this to resolve which customer a document is for and to get their customer_id.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string", description: "Name / phone / company to search for. Omit to list recent customers." } },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "list_products",
    description: "Search the product catalog. Returns price, currency, unit and stock. Use when the user references a product so you can use the correct price and product_id.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string", description: "Product name or SKU to search for." } },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "list_services",
    description: "Search the services catalog. Returns the default price per service. Use when the user references a service.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string", description: "Service name to search for." } },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "search_quotations",
    description: "Find quotations by quotation number or customer name (optionally filtered by status). Use to locate a quotation the user wants to edit or convert.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Quotation number or customer name." },
        status: { type: "string", description: "Optional status filter." },
      },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional(), status: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "get_quotation",
    description: "Fetch a single quotation by id, including its full line items and totals. Call this before updating or converting a quotation.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "The quotation id." } },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({ id: z.string().min(1) }),
    kind: "read",
    op: "read",
  },
  {
    name: "search_invoices",
    description: "Find invoices by invoice number or customer name (optionally filtered by status / payment status). Use to locate an invoice to edit or record a payment against.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Invoice number or customer name." },
        status: { type: "string", description: "Optional status filter." },
        payment_status: { type: "string", description: "Optional payment status filter: pending / partial / complete." },
      },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional(), status: z.string().optional(), payment_status: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "get_invoice",
    description: "Fetch a single invoice by id, including line items, totals and payments. Call this before updating an invoice or recording a payment.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "The invoice id." } },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({ id: z.string().min(1) }),
    kind: "read",
    op: "read",
  },

  // ── Writes ──
  {
    name: "create_quotation",
    description: "Create a new quotation for a customer. Provide line items; the system computes totals. Requires a confirmed customer (use list_customers first).",
    inputSchema: {
      type: "object",
      properties: {
        ...customerRefProps,
        items: { type: "array", items: itemJsonSchema, description: "At least one line item." },
        ...sharedDocProps,
        valid_until: { type: "string", description: "Optional expiry date (YYYY-MM-DD)." },
        status: { type: "string", enum: [...QUOTATION_STATUS_VALUES], description: 'Default "draft".' },
      },
      required: ["customer_id", "customer_name", "items"],
      additionalProperties: false,
    },
    zod: z.object({
      customer_id: z.string().min(1),
      customer_name: z.string().min(1),
      customer_phone: z.string().optional(),
      customer_address: z.string().optional(),
      items: z.array(itemZod).min(1),
      ...sharedDocZod,
      valid_until: z.string().optional(),
      status: z.enum(QUOTATION_STATUS_VALUES).optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "update_quotation",
    description: "Update an existing quotation. Pass the id and only the fields that change (e.g. items, tax, status). Totals are recomputed. Call get_quotation first.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The quotation id to update." },
        ...customerRefProps,
        items: { type: "array", items: itemJsonSchema, description: "Full replacement list of line items, if items change." },
        ...sharedDocProps,
        valid_until: { type: "string", description: "Optional expiry date (YYYY-MM-DD)." },
        status: { type: "string", enum: [...QUOTATION_STATUS_VALUES] },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      customer_id: z.string().optional(),
      customer_name: z.string().optional(),
      customer_phone: z.string().optional(),
      customer_address: z.string().optional(),
      items: z.array(itemZod).min(1).optional(),
      ...sharedDocZod,
      valid_until: z.string().optional(),
      status: z.enum(QUOTATION_STATUS_VALUES).optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "create_invoice",
    description: "Create a new invoice for a customer. Provide line items; the system computes totals and outstanding. Requires a confirmed customer (use list_customers first).",
    inputSchema: {
      type: "object",
      properties: {
        ...customerRefProps,
        items: { type: "array", items: itemJsonSchema, description: "At least one line item." },
        ...sharedDocProps,
        due_date: { type: "string", description: "Optional payment due date (YYYY-MM-DD)." },
        payment_mode: { type: "string", enum: [...PAYMENT_METHOD_VALUES] },
        advance: { type: "number", description: "Advance/prepaid amount already received. Default 0." },
        status: { type: "string", enum: [...INVOICE_STATUS_VALUES], description: 'Default "draft".' },
      },
      required: ["customer_id", "customer_name", "items"],
      additionalProperties: false,
    },
    zod: z.object({
      customer_id: z.string().min(1),
      customer_name: z.string().min(1),
      customer_phone: z.string().optional(),
      customer_address: z.string().optional(),
      items: z.array(itemZod).min(1),
      ...sharedDocZod,
      due_date: z.string().optional(),
      payment_mode: z.enum(PAYMENT_METHOD_VALUES).optional(),
      advance: z.number().min(0).optional(),
      status: z.enum(INVOICE_STATUS_VALUES).optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "update_invoice",
    description: "Update an existing invoice. Pass the id and only the fields that change. Totals are recomputed. Call get_invoice first. To add a payment use record_payment instead.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The invoice id to update." },
        ...customerRefProps,
        items: { type: "array", items: itemJsonSchema, description: "Full replacement list of line items, if items change." },
        ...sharedDocProps,
        due_date: { type: "string", description: "Optional payment due date (YYYY-MM-DD)." },
        payment_mode: { type: "string", enum: [...PAYMENT_METHOD_VALUES] },
        status: { type: "string", enum: [...INVOICE_STATUS_VALUES] },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      customer_id: z.string().optional(),
      customer_name: z.string().optional(),
      customer_phone: z.string().optional(),
      customer_address: z.string().optional(),
      items: z.array(itemZod).min(1).optional(),
      ...sharedDocZod,
      due_date: z.string().optional(),
      payment_mode: z.enum(PAYMENT_METHOD_VALUES).optional(),
      status: z.enum(INVOICE_STATUS_VALUES).optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "convert_quotation",
    description: "Convert a quotation into an invoice. Optionally restrict to specific line item ids. The quotation is marked invoiced.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The quotation id to convert." },
        due_date: { type: "string", description: "Optional invoice due date (YYYY-MM-DD)." },
        payment_mode: { type: "string", enum: [...PAYMENT_METHOD_VALUES] },
        selected_item_ids: { type: "array", items: { type: "number" }, description: "Optional subset of quotation item ids to convert." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      due_date: z.string().optional(),
      payment_mode: z.enum(PAYMENT_METHOD_VALUES).optional(),
      selected_item_ids: z.array(z.number()).optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "record_payment",
    description: "Record a payment against an invoice. Updates the amount paid and payment status. Cannot exceed the outstanding balance.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "The invoice id." },
        amount: { type: "number", description: "Payment amount (> 0)." },
        method: { type: "string", enum: [...PAYMENT_METHOD_VALUES], description: 'Default "cash".' },
        reference: { type: "string", description: "Optional reference / transaction id." },
        note: { type: "string" },
        date: { type: "string", description: "Optional payment date (YYYY-MM-DD). Defaults to today." },
      },
      required: ["invoice_id", "amount"],
      additionalProperties: false,
    },
    zod: z.object({
      invoice_id: z.string().min(1),
      amount: z.number().positive(),
      method: z.enum(PAYMENT_METHOD_VALUES).optional(),
      reference: z.string().optional(),
      note: z.string().optional(),
      date: z.string().optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "create_customer",
    description: "Create a new customer when list_customers finds no match. Pass the name (and any details the user gave); the app shows the user an editable form to complete the phone/address and confirm — so you do NOT need to ask for the phone number in text.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer name (required)." },
        phone_no: { type: "string", description: "Phone, if the user gave one (otherwise the form collects it)." },
        email: { type: "string" },
        address: { type: "string" },
        company: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    zod: z.object({
      name: z.string().min(1),
      phone_no: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      company: z.string().optional(),
    }),
    kind: "write",
    op: "create",
  },
];

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(
  ASSISTANT_TOOLS.map((t) => [t.name, t])
);

/** Tool definitions in the provider-neutral shape consumed by the agent loop. */
export function providerTools(): ProviderTool[] {
  return ASSISTANT_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
