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
    image_index: {
      type: "number",
      description: "0-based index of an attached image to show on this line item (only when the user attached image(s) to their message).",
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
  image_index: z.number().int().min(0).optional(),
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
    description: "List or find quotations — by quotation number or customer name, and/or filtered by status or issue-date range (from/to). Use this to list and filter the user's quotations (e.g. for a customer, drafts, or 'this month').",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Quotation number or customer name." },
        status: { type: "string", description: "Status filter: draft, pending, approved, rejected, cancelled, invoiced, expired." },
        from: { type: "string", description: "Only quotations issued on/after this date (YYYY-MM-DD)." },
        to: { type: "string", description: "Only quotations issued on/before this date (YYYY-MM-DD)." },
      },
      additionalProperties: false,
    },
    zod: z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
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
    description: "List or find invoices — by invoice number or customer name, and/or filtered by status, payment status, or issue-date range (from/to). Use this to list and filter the user's invoices (e.g. for a customer, unpaid, or 'this month').",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Invoice number or customer name." },
        status: { type: "string", description: "Status filter: draft, issued, cancelled." },
        payment_status: { type: "string", description: "Payment status filter: pending, partial, complete." },
        from: { type: "string", description: "Only invoices issued on/after this date (YYYY-MM-DD)." },
        to: { type: "string", description: "Only invoices issued on/before this date (YYYY-MM-DD)." },
      },
      additionalProperties: false,
    },
    zod: z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      payment_status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
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

  {
    name: "list_expenses",
    description: "List or search the user's expenses (read-only). Returns vendor, amount and status.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string", description: "Vendor name or expense number." } },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "list_projects",
    description: "List or search the user's projects (read-only). Returns name, status and budget.",
    inputSchema: {
      type: "object",
      properties: { search: { type: "string", description: "Project name." } },
      additionalProperties: false,
    },
    zod: z.object({ search: z.string().optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "get_summary",
    description: "Get a business summary (read-only): total revenue, received, outstanding, expenses, and document counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    zod: z.object({}),
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
  {
    name: "create_customers",
    description: "Create MULTIPLE customers at once (bulk). Use when the user wants several / N customers — pass them all in one array in a single call. Each needs a name and phone number.",
    inputSchema: {
      type: "object",
      properties: {
        customers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone_no: { type: "string" },
              email: { type: "string" },
              address: { type: "string" },
              company: { type: "string" },
            },
            required: ["name", "phone_no"],
            additionalProperties: false,
          },
        },
      },
      required: ["customers"],
      additionalProperties: false,
    },
    zod: z.object({
      customers: z
        .array(
          z.object({
            name: z.string().min(1),
            phone_no: z.string().min(1),
            email: z.string().optional(),
            address: z.string().optional(),
            company: z.string().optional(),
          })
        )
        .min(1)
        .max(30),
    }),
    kind: "write",
    op: "create",
  },

  // ── Catalog / expense / project management ──
  {
    name: "create_product",
    description: "Add a new product to the catalog. Only the name is required; set price (default_price), stock (stock_qty), SKU, category, unit, etc.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        default_price: { type: "number", description: "Unit price." },
        stock_qty: { type: "number", description: "Stock level." },
        sku: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        unit: { type: "string", description: 'e.g. "pcs", "kg".' },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        low_stock_threshold: { type: "number" },
        is_active: { type: "boolean" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    zod: z.object({
      name: z.string().min(1),
      default_price: z.number().min(0).optional(),
      stock_qty: z.number().min(0).optional(),
      sku: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      unit: z.string().optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      low_stock_threshold: z.number().min(0).optional(),
      is_active: z.boolean().optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "update_product",
    description: "Update a product (price, stock, etc.). Pass the id (from list_products) and only the fields that change.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        default_price: { type: "number" },
        stock_qty: { type: "number" },
        sku: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        unit: { type: "string" },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        low_stock_threshold: { type: "number" },
        is_active: { type: "boolean" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      default_price: z.number().min(0).optional(),
      stock_qty: z.number().min(0).optional(),
      sku: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      unit: z.string().optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      low_stock_threshold: z.number().min(0).optional(),
      is_active: z.boolean().optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "create_products",
    description: "Create MULTIPLE products at once (bulk). Use this whenever the user wants several / N products — pass them all in one array in a single call. Do NOT call create_product repeatedly.",
    inputSchema: {
      type: "object",
      properties: {
        products: {
          type: "array",
          description: "The products to create.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              default_price: { type: "number" },
              stock_qty: { type: "number" },
              sku: { type: "string" },
              description: { type: "string" },
              category: { type: "string" },
              unit: { type: "string" },
              currency: { type: "string", enum: [...CURRENCY_VALUES] },
              low_stock_threshold: { type: "number" },
              is_active: { type: "boolean" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["products"],
      additionalProperties: false,
    },
    zod: z.object({
      products: z
        .array(
          z.object({
            name: z.string().min(1),
            default_price: z.number().min(0).optional(),
            stock_qty: z.number().min(0).optional(),
            sku: z.string().optional(),
            description: z.string().optional(),
            category: z.string().optional(),
            unit: z.string().optional(),
            currency: z.enum(CURRENCY_VALUES).optional(),
            low_stock_threshold: z.number().min(0).optional(),
            is_active: z.boolean().optional(),
          })
        )
        .min(1)
        .max(30),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "create_service",
    description: "Add a new service to the catalog. Only the name is required; set default_price, category, unit, description.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        default_price: { type: "number" },
        category: { type: "string" },
        unit: { type: "string" },
        description: { type: "string" },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        is_active: { type: "boolean" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    zod: z.object({
      name: z.string().min(1),
      default_price: z.number().min(0).optional(),
      category: z.string().optional(),
      unit: z.string().optional(),
      description: z.string().optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      is_active: z.boolean().optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "update_service",
    description: "Update a service (price, category, etc.). Pass the id (from list_services) and only the fields that change.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        default_price: { type: "number" },
        category: { type: "string" },
        unit: { type: "string" },
        description: { type: "string" },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        is_active: { type: "boolean" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      default_price: z.number().min(0).optional(),
      category: z.string().optional(),
      unit: z.string().optional(),
      description: z.string().optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      is_active: z.boolean().optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "create_services",
    description: "Create MULTIPLE services at once (bulk). Use when the user wants several / N services — pass them all in one array in a single call.",
    inputSchema: {
      type: "object",
      properties: {
        services: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              default_price: { type: "number" },
              category: { type: "string" },
              unit: { type: "string" },
              description: { type: "string" },
              currency: { type: "string", enum: [...CURRENCY_VALUES] },
              is_active: { type: "boolean" },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["services"],
      additionalProperties: false,
    },
    zod: z.object({
      services: z
        .array(
          z.object({
            name: z.string().min(1),
            default_price: z.number().min(0).optional(),
            category: z.string().optional(),
            unit: z.string().optional(),
            description: z.string().optional(),
            currency: z.enum(CURRENCY_VALUES).optional(),
            is_active: z.boolean().optional(),
          })
        )
        .min(1)
        .max(30),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "create_project",
    description: "Create a new project for a customer (resolve the customer with list_customers first). Name and customer are required.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        customer_id: { type: "string" },
        customer_name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "on_hold", "cancelled", "complete"] },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        budget: { type: "number" },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        notes: { type: "string" },
      },
      required: ["name", "customer_id", "customer_name"],
      additionalProperties: false,
    },
    zod: z.object({
      name: z.string().min(1),
      customer_id: z.string().min(1),
      customer_name: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(["pending", "in_progress", "on_hold", "cancelled", "complete"] as const).optional(),
      start_date: z.string().optional(),
      due_date: z.string().optional(),
      budget: z.number().min(0).optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      notes: z.string().optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "create_expense",
    description: "Record a new expense. Requires a bill date and at least one line item (name, quantity, unit_price). The total is computed.",
    inputSchema: {
      type: "object",
      properties: {
        bill_date: { type: "string", description: "YYYY-MM-DD (required)." },
        vendor_name: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              category: { type: "string" },
            },
            required: ["name", "quantity", "unit_price"],
            additionalProperties: false,
          },
        },
        tax: { type: "number" },
        tax_type: { type: "string", enum: [...TAX_TYPE_VALUES] },
        discount: { type: "number" },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        payment_method: { type: "string", enum: [...PAYMENT_METHOD_VALUES] },
        notes: { type: "string" },
      },
      required: ["bill_date", "items"],
      additionalProperties: false,
    },
    zod: z.object({
      bill_date: z.string().min(1),
      vendor_name: z.string().optional(),
      items: z
        .array(
          z.object({
            name: z.string().min(1),
            quantity: z.number().min(0),
            unit_price: z.number().min(0),
            category: z.string().optional(),
          })
        )
        .min(1),
      tax: z.number().min(0).optional(),
      tax_type: z.enum(TAX_TYPE_VALUES).optional(),
      discount: z.number().min(0).optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      payment_method: z.enum(PAYMENT_METHOD_VALUES).optional(),
      notes: z.string().optional(),
    }),
    kind: "write",
    op: "create",
  },
  {
    name: "update_project",
    description: "Update an existing project — status, budget, dates, name, description, progress or notes. Find it first with list_projects to get its id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The project id (from list_projects)." },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "on_hold", "cancelled", "complete"] },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        budget: { type: "number" },
        currency: { type: "string", enum: [...CURRENCY_VALUES] },
        progress: { type: "number", description: "0-100" },
        notes: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["pending", "in_progress", "on_hold", "cancelled", "complete"] as const).optional(),
      start_date: z.string().optional(),
      due_date: z.string().optional(),
      budget: z.number().min(0).optional(),
      currency: z.enum(CURRENCY_VALUES).optional(),
      progress: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "update_customer",
    description: "Update an existing customer — name, phone, email, address, company, tax id or notes. Find them first with list_customers to get the id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The customer id (from list_customers)." },
        name: { type: "string" },
        phone_no: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
        company: { type: "string" },
        tax_id: { type: "string" },
        notes: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      phone_no: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      company: z.string().optional(),
      tax_id: z.string().optional(),
      notes: z.string().optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "update_expense",
    description: "Update an existing expense — status, vendor, payment status/method, bill date or notes (not its line items). Find it first with list_expenses.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The expense id (from list_expenses)." },
        vendor_name: { type: "string" },
        status: { type: "string", enum: ["draft", "recorded", "verified", "cancelled"] },
        payment_status: { type: "string", enum: ["pending", "paid", "partial"] },
        payment_method: { type: "string", enum: [...PAYMENT_METHOD_VALUES] },
        bill_date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    zod: z.object({
      id: z.string().min(1),
      vendor_name: z.string().optional(),
      status: z.enum(["draft", "recorded", "verified", "cancelled"] as const).optional(),
      payment_status: z.enum(["pending", "paid", "partial"] as const).optional(),
      payment_method: z.enum(PAYMENT_METHOD_VALUES).optional(),
      bill_date: z.string().optional(),
      notes: z.string().optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "scan_bill",
    description:
      "Read a vendor bill / receipt IMAGE the user attached this turn and extract its vendor, date, currency, tax and line items. Use this whenever the user attaches a bill photo and asks to scan it or create an expense from it. After it returns, immediately call create_expense with the extracted vendor_name, bill_date, currency, tax and items. Returns a draft only — it does NOT save anything.",
    inputSchema: {
      type: "object",
      properties: {
        image_index: { type: "number", description: "0-based index of the attached image to scan (default 0 — the first/only attached image)." },
      },
      required: [],
      additionalProperties: false,
    },
    zod: z.object({ image_index: z.number().int().min(0).optional() }),
    kind: "read",
    op: "read",
  },
  {
    name: "add_project_attachment",
    description:
      "Attach an IMAGE the user attached this turn to a project's files. Use when the user attaches an image and asks to add/attach it to a project. Resolve the project first with list_projects to get its id.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "The project id (from list_projects)." },
        image_index: { type: "number", description: "0-based index of the attached image (default 0)." },
        name: { type: "string", description: "Optional file name to show for the attachment." },
      },
      required: ["project_id"],
      additionalProperties: false,
    },
    zod: z.object({
      project_id: z.string().min(1),
      image_index: z.number().int().min(0).optional(),
      name: z.string().optional(),
    }),
    kind: "write",
    op: "update",
  },
  {
    name: "add_project_time_log",
    description:
      "Log billable time on a project: a number of hours at an hourly rate (amount = hours × rate is computed automatically). Use when the user asks to add/log time or hours on a project (e.g. \"add 100 hours at 1000/hour\"). Resolve the project first with list_projects to get its id.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "The project id (from list_projects)." },
        hours: { type: "number", description: "Number of hours (>= 0)." },
        rate: { type: "number", description: "Hourly rate in the project currency (>= 0)." },
        description: { type: "string", description: "Optional note describing the work." },
        date: { type: "string", description: "Optional YYYY-MM-DD; defaults to today." },
      },
      required: ["project_id", "hours", "rate"],
      additionalProperties: false,
    },
    zod: z.object({
      project_id: z.string().min(1),
      hours: z.number().min(0),
      rate: z.number().min(0),
      description: z.string().optional(),
      date: z.string().optional(),
    }),
    kind: "write",
    op: "update",
  },
];

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(
  ASSISTANT_TOOLS.map((t) => [t.name, t])
);

/** Tool definitions in the provider-neutral shape consumed by the agent loop.
 *  Pass `enabled` (a set of allowed tool names) to gate by feature toggles. */
export function providerTools(enabled?: Set<string>): ProviderTool[] {
  return ASSISTANT_TOOLS.filter((t) => !enabled || enabled.has(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
