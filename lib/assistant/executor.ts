import { randomUUID } from "crypto";
import { can } from "@/lib/rbac";
import { formatCurrency } from "@/lib/utils";
import { computeDocumentTotals } from "@/lib/calc/document-totals";
import { richTextToPlainText } from "@/lib/rich-text/normalize";
import type { AssistantFormField, AssistantPendingActionPreview } from "@/types";
import { TOOL_MAP } from "./tools";
import type {
  ReadToolResult,
  StoredPendingAction,
  ToolContext,
  WriteExecResult,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Self-call plumbing ───────────────────────────────────────────────────────

interface SelfFetchResult {
  ok: boolean;
  status: number;
  json: any;
}

/**
 * Call quotesphere's OWN API route server-to-server, forwarding the caller's
 * session cookie so the route's auth() + requireRole() apply unchanged. This is
 * the ONLY way the assistant ever persists data — never the DB directly.
 */
async function selfFetch(
  ctx: ToolContext,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<SelfFetchResult> {
  let res: Response;
  try {
    res = await fetch(`${ctx.baseUrl}${path}`, {
      method,
      headers: { cookie: ctx.cookie, "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    // Network-level failure (wrong origin/port, server down) — surface it cleanly
    // instead of throwing, so the tool reports a graceful error.
    console.error(`[assistant selfFetch] ${method} ${ctx.baseUrl}${path} threw:`, e);
    return { ok: false, status: 0, json: { error: e instanceof Error ? e.message : "Could not reach the app API." } };
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const ok = res.ok && json?.success !== false;
  if (!ok) console.error(`[assistant selfFetch] ${method} ${ctx.baseUrl}${path} -> HTTP ${res.status}`, json);
  return { ok, status: res.status, json };
}

/** Extract a human-readable error from the `{ success:false, error }` envelope. */
function errMsg(json: any, status: number): string {
  if (json && typeof json.error === "string") return json.error;
  if (json && json.error && typeof json.error === "object") {
    const parts = Object.entries(json.error).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`
    );
    if (parts.length) return parts.join("; ");
  }
  return `Request failed (HTTP ${status}).`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchCustomer(ctx: ToolContext, id: string): Promise<any | null> {
  const r = await selfFetch(ctx, "GET", `/api/customers/${id}`);
  if (!r.ok) return null;
  // GET /api/customers/[id] returns { customer, invoices } — unwrap to the customer.
  const d = r.json?.data;
  return d?.customer ?? d ?? null;
}

function fmt(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

function numberItems(
  items: Array<{ name: string; quantity: number; price: number; product_id?: string; image_index?: number }>,
  attachments: string[] = []
) {
  return items.map((it, i) => {
    const img =
      typeof it.image_index === "number" && it.image_index >= 0 && it.image_index < attachments.length
        ? attachments[it.image_index]
        : undefined;
    return {
      id: i + 1,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      ...(it.product_id ? { product_id: it.product_id } : {}),
      ...(img ? { images: [img] } : {}),
    };
  });
}

function statusOptionsFor(docType: "quotation" | "invoice", current: string): { value: string; label: string }[] {
  const base = docType === "invoice" ? ["draft", "issued"] : ["draft", "pending", "approved"];
  const values = base.includes(current) ? base : [current, ...base];
  return values.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
}

function docPreview(
  customerName: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  totals: { sub_total: number; tax_amount: number; total_amount: number },
  currency: string,
  tax: number,
  taxType: "percentage" | "value"
): AssistantPendingActionPreview[] {
  const preview: AssistantPendingActionPreview[] = [
    { label: "Customer", value: customerName },
    {
      label: "Items",
      value: items.map((i) => `${i.quantity} × ${i.name} @ ${fmt(i.price, currency)}`).join("\n"),
    },
    { label: "Subtotal", value: fmt(totals.sub_total, currency) },
  ];
  if (totals.tax_amount > 0) {
    preview.push({
      label: taxType === "percentage" ? `Tax (${tax}%)` : "Tax",
      value: fmt(totals.tax_amount, currency),
    });
  }
  preview.push({ label: "Total", value: fmt(totals.total_amount, currency) });
  return preview;
}

// ─── Read tools ───────────────────────────────────────────────────────────────

export async function executeReadTool(
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<ReadToolResult> {
  const def = TOOL_MAP[name];
  if (!def) return { ok: false, summary: `Unknown tool`, data: { error: `Unknown tool ${name}` } };
  if (ctx.enabledTools && !ctx.enabledTools.has(name)) {
    return { ok: false, summary: "Feature disabled", data: { error: `The ${name} capability is turned off in the assistant settings.` } };
  }
  const parsed = def.zod.safeParse(input);
  if (!parsed.success) {
    return { ok: false, summary: "Invalid input", data: { error: parsed.error.issues.map((i) => i.message).join("; ") } };
  }
  const a: any = parsed.data;

  switch (name) {
    case "list_customers": {
      const q = a.search ? `?search=${encodeURIComponent(a.search)}&limit=10` : `?limit=10`;
      const r = await selfFetch(ctx, "GET", `/api/customers${q}`);
      if (!r.ok) return { ok: false, summary: "Customer lookup failed", data: { error: errMsg(r.json, r.status) } };
      const customers = (r.json.data ?? []).map((c: any) => ({
        id: c._id,
        name: c.name,
        phone: c.phone_no,
        email: c.email,
        company: c.company,
        address: c.address,
        currency: c.currency,
      }));
      return { ok: true, summary: `Found ${customers.length} customer(s)`, data: { customers } };
    }
    case "list_products": {
      const q = a.search ? `?search=${encodeURIComponent(a.search)}` : ``;
      const r = await selfFetch(ctx, "GET", `/api/products${q}`);
      if (!r.ok) return { ok: false, summary: "Product lookup failed", data: { error: errMsg(r.json, r.status) } };
      const products = (r.json.data ?? []).map((p: any) => ({
        id: p._id,
        name: p.name,
        sku: p.sku,
        price: p.default_price,
        currency: p.currency,
        unit: p.unit,
        stock: p.stock_qty,
      }));
      return { ok: true, summary: `Found ${products.length} product(s)`, data: { products } };
    }
    case "list_services": {
      const q = a.search ? `?search=${encodeURIComponent(a.search)}` : ``;
      const r = await selfFetch(ctx, "GET", `/api/services${q}`);
      if (!r.ok) return { ok: false, summary: "Service lookup failed", data: { error: errMsg(r.json, r.status) } };
      const services = (r.json.data ?? []).map((s: any) => ({
        id: s._id,
        name: s.name,
        price: s.default_price,
        currency: s.currency,
        unit: s.unit,
        category: s.category,
      }));
      return { ok: true, summary: `Found ${services.length} service(s)`, data: { services } };
    }
    case "search_quotations": {
      const params = new URLSearchParams({ limit: "10" });
      if (a.search) params.set("search", a.search);
      if (a.status) params.set("status", a.status);
      if (a.from) params.set("from", a.from);
      if (a.to) params.set("to", a.to);
      const r = await selfFetch(ctx, "GET", `/api/quotations?${params.toString()}`);
      if (!r.ok) return { ok: false, summary: "Quotation search failed", data: { error: errMsg(r.json, r.status) } };
      const quotations = (r.json.data ?? []).map((q: any) => ({
        id: q._id,
        quotation_no: q.quotation_no,
        customer_name: q.customer_name,
        total_amount: q.total_amount,
        currency: q.currency,
        status: q.status,
      }));
      return { ok: true, summary: `Found ${quotations.length} quotation(s)`, data: { quotations } };
    }
    case "search_invoices": {
      const params = new URLSearchParams({ limit: "10" });
      if (a.search) params.set("search", a.search);
      if (a.status) params.set("status", a.status);
      if (a.payment_status) params.set("payment_status", a.payment_status);
      if (a.from) params.set("from", a.from);
      if (a.to) params.set("to", a.to);
      const r = await selfFetch(ctx, "GET", `/api/invoices?${params.toString()}`);
      if (!r.ok) return { ok: false, summary: "Invoice search failed", data: { error: errMsg(r.json, r.status) } };
      const invoices = (r.json.data ?? []).map((inv: any) => ({
        id: inv._id,
        invoice_no: inv.invoice_no,
        customer_name: inv.customer_name,
        total_amount: inv.total_amount,
        outstanding: inv.outstanding,
        currency: inv.currency,
        status: inv.status,
        payment_status: inv.payment_status,
      }));
      return { ok: true, summary: `Found ${invoices.length} invoice(s)`, data: { invoices } };
    }
    case "get_quotation": {
      const r = await selfFetch(ctx, "GET", `/api/quotations/${a.id}`);
      if (!r.ok) return { ok: false, summary: "Quotation not found", data: { error: errMsg(r.json, r.status) } };
      const q = r.json.data;
      return { ok: true, summary: `Loaded ${q.quotation_no}`, data: { quotation: trimDoc(q) } };
    }
    case "get_invoice": {
      const r = await selfFetch(ctx, "GET", `/api/invoices/${a.id}`);
      if (!r.ok) return { ok: false, summary: "Invoice not found", data: { error: errMsg(r.json, r.status) } };
      const inv = r.json.data;
      return { ok: true, summary: `Loaded ${inv.invoice_no}`, data: { invoice: trimDoc(inv) } };
    }
    case "list_expenses": {
      const q = a.search ? `?search=${encodeURIComponent(a.search)}&limit=10` : `?limit=10`;
      const r = await selfFetch(ctx, "GET", `/api/expenses${q}`);
      if (!r.ok) return { ok: false, summary: "Expense lookup failed", data: { error: errMsg(r.json, r.status) } };
      const expenses = (r.json.data ?? []).map((e: any) => ({
        id: e._id,
        expense_no: e.expense_no,
        vendor: e.vendor_name,
        total_amount: e.total_amount,
        currency: e.currency,
        status: e.status,
        date: e.bill_date,
      }));
      return { ok: true, summary: `Found ${expenses.length} expense(s)`, data: { expenses } };
    }
    case "list_projects": {
      const q = a.search ? `?search=${encodeURIComponent(a.search)}&limit=10` : `?limit=10`;
      const r = await selfFetch(ctx, "GET", `/api/projects${q}`);
      if (!r.ok) return { ok: false, summary: "Project lookup failed", data: { error: errMsg(r.json, r.status) } };
      const projects = (r.json.data ?? []).map((p: any) => ({
        id: p._id,
        project_no: p.project_no,
        name: p.name,
        status: p.status,
        budget: p.budget,
        currency: p.currency,
        customer: p.customer_name,
      }));
      return { ok: true, summary: `Found ${projects.length} project(s)`, data: { projects } };
    }
    case "get_summary": {
      const r = await selfFetch(ctx, "GET", `/api/dashboard`);
      if (!r.ok) return { ok: false, summary: "Summary failed", data: { error: errMsg(r.json, r.status) } };
      const d = r.json.data ?? {};
      return {
        ok: true,
        summary: "Loaded business summary",
        data: {
          summary: {
            totalRevenue: d.totalRevenue,
            totalReceived: d.totalReceived,
            totalOutstanding: d.totalOutstanding,
            totalExpenses: d.totalExpenses,
            invoiceCount: d.invoiceCount,
            quotationCount: d.quotationCount,
            customerCount: d.customerCount,
            overdueCount: d.overdueCount,
          },
        },
      };
    }
    case "scan_bill": {
      const idx = a.image_index ?? 0;
      const imageUrl = ctx.attachments?.[idx];
      if (!imageUrl) {
        return { ok: false, summary: "No image attached", data: { error: "No image is attached to this message. Ask the user to attach the bill photo, then try again." } };
      }
      const r = await selfFetch(ctx, "POST", "/api/expenses/scan", { imageUrl });
      if (!r.ok) return { ok: false, summary: "Bill scan failed", data: { error: errMsg(r.json, r.status) } };
      const d = r.json.data ?? {};
      return {
        ok: true,
        summary: `Scanned bill${d.vendor_name ? ` from ${d.vendor_name}` : ""}`,
        data: {
          vendor_name: d.vendor_name ?? "",
          bill_date: d.bill_date ?? "",
          currency: d.currency ?? ctx.defaultCurrency,
          tax: d.tax ?? 0,
          items: (d.items ?? []).map((it: any) => ({ name: it.name, quantity: it.quantity, unit_price: it.unit_price })),
          next_step: "Now call create_expense with this vendor_name, bill_date, currency, tax and items (each item: name, quantity, unit_price). Do NOT ask the user to re-enter anything.",
        },
      };
    }
    default:
      return { ok: false, summary: "Not a read tool", data: { error: `${name} is not a read tool` } };
  }
}

/** Trim a full document to the fields the model needs to reason about / edit. */
function trimDoc(d: any) {
  return {
    id: d._id,
    number: d.quotation_no ?? d.invoice_no,
    customer_id: d.customer_id,
    customer_name: d.customer_name,
    status: d.status,
    payment_status: d.payment_status,
    currency: d.currency,
    tax: d.tax,
    tax_type: d.tax_type,
    discount: d.discount,
    delivery_charges: d.delivery_charges,
    sub_total: d.sub_total,
    total_amount: d.total_amount,
    outstanding: d.outstanding,
    advance: d.advance,
    items: (d.items ?? []).map((it: any) => ({
      id: it.id,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      product_id: it.product_id,
    })),
    valid_until: d.valid_until,
    due_date: d.due_date,
    remarks: richTextToPlainText(d.remarks),
  };
}

// ─── Write tools — build the pending action (no execution yet) ─────────────────

export async function buildPendingAction(
  toolCallId: string,
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<StoredPendingAction | { error: string }> {
  const def = TOOL_MAP[name];
  if (!def || def.kind !== "write") return { error: `Unknown write tool ${name}` };
  if (ctx.enabledTools && !ctx.enabledTools.has(name)) {
    return { error: `That capability is turned off in the assistant settings.` };
  }
  if (!can(ctx.role, def.op)) {
    return { error: `You don't have permission to ${def.op} (your role is ${ctx.role ?? "unknown"}).` };
  }
  const parsed = def.zod.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const a: any = parsed.data;
  const id = randomUUID();
  const base = { id, toolCallId, siblingResults: [] as never[] };

  switch (name) {
    case "create_quotation":
    case "create_invoice": {
      const customer = await fetchCustomer(ctx, a.customer_id);
      if (!customer) {
        return { error: `Couldn't find customer ${a.customer_id}. Use list_customers to find a valid customer first.` };
      }
      const isInvoice = name === "create_invoice";
      const items = numberItems(a.items, ctx.attachments);
      const tax = a.tax ?? 0;
      const taxType = a.tax_type ?? "percentage";
      const currency = a.currency ?? customer.currency ?? ctx.defaultCurrency;
      const totals = computeDocumentTotals({
        items,
        tax,
        tax_type: taxType,
        discount: a.discount ?? 0,
        delivery_charges: a.delivery_charges ?? 0,
        advance: isInvoice ? a.advance ?? 0 : 0,
      });
      const payload: Record<string, unknown> = {
        customer_id: a.customer_id,
        customer_name: customer.name ?? a.customer_name,
        customer_phone: customer.phone_no ?? a.customer_phone ?? "",
        customer_address: customer.address ?? a.customer_address,
        issue_date: today(),
        items,
        tax,
        tax_type: taxType,
        discount: a.discount ?? 0,
        delivery_charges: a.delivery_charges ?? 0,
        sub_total: totals.sub_total,
        total_amount: totals.total_amount,
        currency,
        remarks: a.remarks,
        status: a.status ?? "draft",
      };
      if (isInvoice) {
        payload.advance = a.advance ?? 0;
        if (a.due_date) payload.due_date = a.due_date;
        if (a.payment_mode) payload.payment_mode = a.payment_mode;
      } else if (a.valid_until) {
        payload.valid_until = a.valid_until;
      }
      const noun = isInvoice ? "invoice" : "quotation";
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: isInvoice ? "/api/invoices" : "/api/quotations",
        payload,
        docType: noun,
        title: `Create ${noun}`,
        summary: `Create a ${noun} for ${customer.name} — ${items.length} item(s), total ${fmt(totals.total_amount, currency)}.`,
        preview: docPreview(customer.name, items, totals, currency, tax, taxType),
        statusValue: (a.status ?? "draft") as string,
        statusOptions: statusOptionsFor(noun, (a.status ?? "draft") as string),
      };
    }

    case "update_quotation":
    case "update_invoice": {
      const isInvoice = name === "update_invoice";
      const path = isInvoice ? "/api/invoices" : "/api/quotations";
      const cur = await selfFetch(ctx, "GET", `${path}/${a.id}`);
      if (!cur.ok) return { error: errMsg(cur.json, cur.status) };
      const doc = cur.json.data;

      // Optionally re-point to a different customer.
      let customer: any = null;
      if (a.customer_id && a.customer_id !== String(doc.customer_id)) {
        customer = await fetchCustomer(ctx, a.customer_id);
        if (!customer) return { error: `Couldn't find customer ${a.customer_id}.` };
      }

      const items = a.items ? numberItems(a.items, ctx.attachments) : (doc.items ?? []);
      const tax = a.tax ?? doc.tax ?? 0;
      const taxType = a.tax_type ?? doc.tax_type ?? "percentage";
      const discount = a.discount ?? doc.discount ?? 0;
      const delivery = a.delivery_charges ?? doc.delivery_charges ?? 0;
      const currency = a.currency ?? doc.currency ?? ctx.defaultCurrency;
      const totals = computeDocumentTotals({
        items,
        tax,
        tax_type: taxType,
        discount,
        delivery_charges: delivery,
        advance: isInvoice ? doc.advance ?? 0 : 0,
      });

      const payload: Record<string, unknown> = {
        items,
        tax,
        tax_type: taxType,
        discount,
        delivery_charges: delivery,
        sub_total: totals.sub_total,
        total_amount: totals.total_amount,
        currency,
      };
      if (customer) {
        payload.customer_id = a.customer_id;
        payload.customer_name = customer.name;
        payload.customer_phone = customer.phone_no;
        payload.customer_address = customer.address;
      }
      if (a.remarks !== undefined) payload.remarks = a.remarks;
      if (a.status) payload.status = a.status;
      if (!isInvoice && a.valid_until !== undefined) payload.valid_until = a.valid_until;
      if (isInvoice && a.due_date !== undefined) payload.due_date = a.due_date;
      if (isInvoice && a.payment_mode) payload.payment_mode = a.payment_mode;

      const noun = isInvoice ? "invoice" : "quotation";
      const customerName = customer?.name ?? doc.customer_name;
      return {
        ...base,
        tool: name,
        method: "PUT",
        endpoint: `${path}/${a.id}`,
        payload,
        docType: noun,
        title: `Update ${noun} ${doc.quotation_no ?? doc.invoice_no ?? ""}`.trim(),
        summary: `Update ${noun} ${doc.quotation_no ?? doc.invoice_no} — new total ${fmt(totals.total_amount, currency)}.`,
        preview: docPreview(customerName, items, totals, currency, tax, taxType),
        statusValue: (a.status ?? doc.status) as string,
        statusOptions: statusOptionsFor(noun, (a.status ?? doc.status) as string),
      };
    }

    case "convert_quotation": {
      const cur = await selfFetch(ctx, "GET", `/api/quotations/${a.id}`);
      if (!cur.ok) return { error: errMsg(cur.json, cur.status) };
      const doc = cur.json.data;
      if (doc.status === "invoiced") return { error: `Quotation ${doc.quotation_no} has already been converted.` };
      const payload: Record<string, unknown> = {};
      if (a.due_date) payload.due_date = a.due_date;
      if (a.payment_mode) payload.payment_mode = a.payment_mode;
      if (a.selected_item_ids) payload.selectedItemIds = a.selected_item_ids;
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: `/api/quotations/${a.id}/convert`,
        payload,
        docType: "invoice",
        title: `Convert ${doc.quotation_no} to invoice`,
        summary: `Convert quotation ${doc.quotation_no} (${fmt(doc.total_amount, doc.currency)}) into an invoice.`,
        preview: [
          { label: "Quotation", value: doc.quotation_no },
          { label: "Customer", value: doc.customer_name },
          { label: "Total", value: fmt(doc.total_amount, doc.currency) },
        ],
      };
    }

    case "record_payment": {
      const cur = await selfFetch(ctx, "GET", `/api/invoices/${a.invoice_id}`);
      if (!cur.ok) return { error: errMsg(cur.json, cur.status) };
      const inv = cur.json.data;
      const method = a.method ?? "cash";
      const payload: Record<string, unknown> = { amount: a.amount, method };
      if (a.reference) payload.reference = a.reference;
      if (a.note) payload.note = a.note;
      if (a.date) payload.date = a.date;
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: `/api/invoices/${a.invoice_id}/payments`,
        payload,
        docType: "invoice",
        title: `Record payment on ${inv.invoice_no}`,
        summary: `Record a ${fmt(a.amount, inv.currency)} ${method} payment on invoice ${inv.invoice_no} (outstanding ${fmt(inv.outstanding, inv.currency)}).`,
        preview: [
          { label: "Invoice", value: inv.invoice_no },
          { label: "Amount", value: fmt(a.amount, inv.currency) },
          { label: "Method", value: method },
          { label: "Outstanding before", value: fmt(inv.outstanding, inv.currency) },
        ],
      };
    }

    case "create_customer": {
      // Editable form card — the user completes phone/address and confirms.
      const payload: Record<string, unknown> = {
        name: a.name ?? "",
        phone_no: a.phone_no ?? "",
        email: a.email ?? "",
        address: a.address ?? "",
        company: a.company ?? "",
      };
      const form: AssistantFormField[] = [
        { key: "name", label: "Name", type: "text", value: a.name ?? "", required: true, placeholder: "Customer name" },
        { key: "phone_no", label: "Phone", type: "tel", value: a.phone_no ?? "", required: true, placeholder: "e.g. 923001234567" },
        { key: "email", label: "Email", type: "email", value: a.email ?? "", required: false, placeholder: "name@example.com" },
        { key: "address", label: "Address", type: "text", value: a.address ?? "", required: false, placeholder: "Address" },
        { key: "company", label: "Company", type: "text", value: a.company ?? "", required: false, placeholder: "Company" },
      ];
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: "/api/customers",
        payload,
        docType: "customer",
        title: "New customer",
        summary: `Add ${a.name} to your customers — review the details and confirm.`,
        preview: [],
        form,
      };
    }

    case "create_product":
    case "update_product": {
      const isUpdate = name === "update_product";
      const currency = a.currency ?? ctx.defaultCurrency;
      const payload: Record<string, unknown> = {};
      for (const k of ["name", "default_price", "stock_qty", "sku", "description", "category", "unit", "low_stock_threshold", "is_active", "currency"] as const) {
        if (a[k] !== undefined) payload[k] = a[k];
      }
      return {
        ...base,
        tool: name,
        method: isUpdate ? "PUT" : "POST",
        endpoint: isUpdate ? `/api/products/${a.id}` : "/api/products",
        payload,
        docType: "product",
        title: isUpdate ? "Update product" : "Create product",
        summary: isUpdate
          ? `Update product ${a.name ?? a.id}.`
          : `Add product ${a.name}${a.default_price !== undefined ? ` — ${fmt(a.default_price, currency)}` : ""}${a.stock_qty !== undefined ? `, stock ${a.stock_qty}` : ""}.`,
        preview: [
          { label: "Name", value: a.name ?? "(unchanged)" },
          ...(a.default_price !== undefined ? [{ label: "Price", value: fmt(a.default_price, currency) }] : []),
          ...(a.stock_qty !== undefined ? [{ label: "Stock", value: String(a.stock_qty) }] : []),
          ...(a.category ? [{ label: "Category", value: a.category }] : []),
        ],
      };
    }

    case "create_products": {
      const products = a.products.map((p: any) => ({
        name: p.name,
        default_price: p.default_price ?? 0,
        stock_qty: p.stock_qty ?? 0,
        currency: p.currency ?? ctx.defaultCurrency,
        is_active: p.is_active ?? true,
        ...(p.sku ? { sku: p.sku } : {}),
        ...(p.description ? { description: p.description } : {}),
        ...(p.category ? { category: p.category } : {}),
        ...(p.unit ? { unit: p.unit } : {}),
        ...(p.low_stock_threshold !== undefined ? { low_stock_threshold: p.low_stock_threshold } : {}),
      }));
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: "/api/products",
        payload: { products },
        docType: "product",
        title: `Create ${products.length} products`,
        summary: `Add ${products.length} products to the catalog.`,
        preview: [
          {
            label: `Products (${products.length})`,
            value: products.map((p: any) => `${p.name} — ${fmt(p.default_price, p.currency)}, stock ${p.stock_qty}`).join("\n"),
          },
        ],
      };
    }

    case "create_customers": {
      const customers = a.customers.map((c: any) => ({
        name: c.name,
        phone_no: c.phone_no,
        ...(c.email ? { email: c.email } : {}),
        ...(c.address ? { address: c.address } : {}),
        ...(c.company ? { company: c.company } : {}),
      }));
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: "/api/customers",
        payload: { customers },
        docType: "customer",
        title: `Create ${customers.length} customers`,
        summary: `Add ${customers.length} customers.`,
        preview: [
          { label: `Customers (${customers.length})`, value: customers.map((c: any) => `${c.name} — ${c.phone_no}`).join("\n") },
        ],
      };
    }

    case "create_services": {
      const services = a.services.map((s: any) => ({
        name: s.name,
        default_price: s.default_price ?? 0,
        currency: s.currency ?? ctx.defaultCurrency,
        is_active: s.is_active ?? true,
        ...(s.category ? { category: s.category } : {}),
        ...(s.unit ? { unit: s.unit } : {}),
        ...(s.description ? { description: s.description } : {}),
      }));
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: "/api/services",
        payload: { services },
        docType: "service",
        title: `Create ${services.length} services`,
        summary: `Add ${services.length} services.`,
        preview: [
          { label: `Services (${services.length})`, value: services.map((s: any) => `${s.name} — ${fmt(s.default_price, s.currency)}`).join("\n") },
        ],
      };
    }

    case "create_service":
    case "update_service": {
      const isUpdate = name === "update_service";
      const currency = a.currency ?? ctx.defaultCurrency;
      const payload: Record<string, unknown> = {};
      for (const k of ["name", "default_price", "category", "unit", "description", "is_active", "currency"] as const) {
        if (a[k] !== undefined) payload[k] = a[k];
      }
      return {
        ...base,
        tool: name,
        method: isUpdate ? "PUT" : "POST",
        endpoint: isUpdate ? `/api/services/${a.id}` : "/api/services",
        payload,
        docType: "service",
        title: isUpdate ? "Update service" : "Create service",
        summary: isUpdate
          ? `Update service ${a.name ?? a.id}.`
          : `Add service ${a.name}${a.default_price !== undefined ? ` — ${fmt(a.default_price, currency)}` : ""}.`,
        preview: [
          { label: "Name", value: a.name ?? "(unchanged)" },
          ...(a.default_price !== undefined ? [{ label: "Price", value: fmt(a.default_price, currency) }] : []),
          ...(a.category ? [{ label: "Category", value: a.category }] : []),
        ],
      };
    }

    case "create_project": {
      const customer = await fetchCustomer(ctx, a.customer_id);
      if (!customer) return { error: `Couldn't find customer ${a.customer_id}. Use list_customers first.` };
      const currency = a.currency ?? customer.currency ?? ctx.defaultCurrency;
      const payload: Record<string, unknown> = {
        name: a.name,
        customer_id: a.customer_id,
        customer_name: customer.name ?? a.customer_name,
        customer_phone: customer.phone_no,
        currency,
      };
      if (a.description) payload.description = a.description;
      if (a.status) payload.status = a.status;
      if (a.start_date) payload.start_date = a.start_date;
      if (a.due_date) payload.due_date = a.due_date;
      if (a.budget !== undefined) payload.budget = a.budget;
      if (a.notes) payload.notes = a.notes;
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: "/api/projects",
        payload,
        docType: "project",
        title: "Create project",
        summary: `Create project "${a.name}" for ${customer.name}${a.budget !== undefined ? ` — budget ${fmt(a.budget, currency)}` : ""}.`,
        preview: [
          { label: "Name", value: a.name },
          { label: "Customer", value: customer.name },
          ...(a.budget !== undefined ? [{ label: "Budget", value: fmt(a.budget, currency) }] : []),
          ...(a.due_date ? [{ label: "Due", value: a.due_date }] : []),
        ],
      };
    }

    case "create_expense": {
      const items = a.items.map((it: any, i: number) => ({
        id: i + 1,
        name: it.name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
        ...(it.category ? { category: it.category } : {}),
      }));
      const sub_total = items.reduce((s: number, it: any) => s + it.total, 0);
      const tax = a.tax ?? 0;
      const taxType = a.tax_type ?? "percentage";
      const taxAmt = taxType === "percentage" ? (sub_total * tax) / 100 : tax;
      const total_amount = sub_total + taxAmt - (a.discount ?? 0);
      const currency = a.currency ?? ctx.defaultCurrency;
      const payload: Record<string, unknown> = {
        bill_date: a.bill_date,
        items,
        tax,
        tax_type: taxType,
        discount: a.discount ?? 0,
        currency,
      };
      if (a.vendor_name) payload.vendor_name = a.vendor_name;
      if (a.payment_method) payload.payment_method = a.payment_method;
      if (a.notes) payload.notes = a.notes;
      return {
        ...base,
        tool: name,
        method: "POST",
        endpoint: "/api/expenses",
        payload,
        docType: "expense",
        title: "Record expense",
        summary: `Record an expense${a.vendor_name ? ` for ${a.vendor_name}` : ""} — ${items.length} item(s), total ${fmt(total_amount, currency)}.`,
        preview: [
          ...(a.vendor_name ? [{ label: "Vendor", value: a.vendor_name }] : []),
          { label: "Items", value: items.map((i: any) => `${i.quantity} × ${i.name} @ ${fmt(i.unit_price, currency)}`).join("\n") },
          { label: "Total", value: fmt(total_amount, currency) },
          { label: "Date", value: a.bill_date },
        ],
      };
    }

    case "update_project": {
      const payload: Record<string, unknown> = {};
      for (const k of ["name", "description", "status", "start_date", "due_date", "budget", "currency", "progress", "notes"] as const) {
        if (a[k] !== undefined) payload[k] = a[k];
      }
      return {
        ...base, tool: name, method: "PUT", endpoint: `/api/projects/${a.id}`, payload, docType: "project",
        title: "Update project",
        summary: `Update project ${a.name ?? a.id}${a.status ? ` — ${a.status}` : ""}.`,
        preview: [
          ...(a.name ? [{ label: "Name", value: a.name }] : []),
          ...(a.status ? [{ label: "Status", value: a.status }] : []),
          ...(a.budget !== undefined ? [{ label: "Budget", value: fmt(a.budget, a.currency ?? ctx.defaultCurrency) }] : []),
          ...(a.due_date ? [{ label: "Due", value: a.due_date }] : []),
        ],
      };
    }

    case "update_customer": {
      const payload: Record<string, unknown> = {};
      for (const k of ["name", "phone_no", "email", "address", "company", "tax_id", "notes"] as const) {
        if (a[k] !== undefined) payload[k] = a[k];
      }
      return {
        ...base, tool: name, method: "PUT", endpoint: `/api/customers/${a.id}`, payload, docType: "customer",
        title: "Update customer",
        summary: `Update customer ${a.name ?? a.id}.`,
        preview: [
          ...(a.name ? [{ label: "Name", value: a.name }] : []),
          ...(a.phone_no ? [{ label: "Phone", value: a.phone_no }] : []),
          ...(a.email ? [{ label: "Email", value: a.email }] : []),
        ],
      };
    }

    case "update_expense": {
      const payload: Record<string, unknown> = {};
      for (const k of ["vendor_name", "status", "payment_status", "payment_method", "bill_date", "notes"] as const) {
        if (a[k] !== undefined) payload[k] = a[k];
      }
      return {
        ...base, tool: name, method: "PUT", endpoint: `/api/expenses/${a.id}`, payload, docType: "expense",
        title: "Update expense",
        summary: `Update expense ${a.id}${a.status ? ` — ${a.status}` : ""}.`,
        preview: [
          ...(a.vendor_name ? [{ label: "Vendor", value: a.vendor_name }] : []),
          ...(a.status ? [{ label: "Status", value: a.status }] : []),
          ...(a.payment_status ? [{ label: "Payment", value: a.payment_status }] : []),
        ],
      };
    }

    case "add_project_attachment": {
      const idx = a.image_index ?? 0;
      const url = ctx.attachments?.[idx];
      if (!url) return { error: "No image is attached to this message. Ask the user to attach the image first, then try again." };
      const proj = await selfFetch(ctx, "GET", `/api/projects/${a.project_id}`);
      if (!proj.ok) return { error: `Couldn't find project ${a.project_id}. Use list_projects first.` };
      const project = proj.json.data ?? {};
      const fileName = a.name || `attachment-${idx + 1}.jpg`;
      return {
        ...base, tool: name, method: "POST", endpoint: `/api/projects/${a.project_id}/attachments`,
        payload: { url, name: fileName, type: "image", size: 0 },
        docType: "project",
        title: "Attach image to project",
        summary: `Attach an image to ${project.name ?? "the project"}.`,
        preview: [
          { label: "Project", value: project.name ?? a.project_id },
          { label: "File", value: fileName },
          { label: "Image", value: url },
        ],
      };
    }

    case "add_project_time_log": {
      const proj = await selfFetch(ctx, "GET", `/api/projects/${a.project_id}`);
      if (!proj.ok) return { error: `Couldn't find project ${a.project_id}. Use list_projects first.` };
      const project = proj.json.data ?? {};
      const currency = project.currency ?? ctx.defaultCurrency;
      const amount = (Number(a.hours) || 0) * (Number(a.rate) || 0);
      return {
        ...base, tool: name, method: "POST", endpoint: `/api/time-entries`,
        payload: {
          project_id: a.project_id,
          date: a.date || new Date().toISOString().slice(0, 10),
          hours: a.hours,
          hourly_rate: a.rate,
          description: a.description || `${a.hours}h @ ${a.rate}/hr`,
          currency,
        },
        docType: "project",
        title: "Log time on project",
        summary: `Log ${a.hours}h @ ${fmt(a.rate, currency)}/hr — ${fmt(amount, currency)} on ${project.name ?? "the project"}.`,
        preview: [
          { label: "Project", value: project.name ?? a.project_id },
          { label: "Hours", value: String(a.hours) },
          { label: "Rate", value: `${fmt(a.rate, currency)}/hr` },
          { label: "Amount", value: fmt(amount, currency) },
          ...(a.description ? [{ label: "Note", value: a.description }] : []),
        ],
      };
    }

    default:
      return { error: `Unsupported write tool ${name}` };
  }
}

// ─── Write tools — execute an approved pending action ──────────────────────────

export async function runPendingAction(
  action: StoredPendingAction,
  ctx: ToolContext
): Promise<WriteExecResult> {
  const def = TOOL_MAP[action.tool];
  if (def && !can(ctx.role, def.op)) {
    return { ok: false, data: { error: "Permission denied." }, summary: "Permission denied" };
  }

  // Bulk creation — POST each item to the resource endpoint.
  const BULK: Record<string, { key: string; endpoint: string; link: string; noun: string }> = {
    create_products: { key: "products", endpoint: "/api/products", link: "/products", noun: "product" },
    create_services: { key: "services", endpoint: "/api/services", link: "/services", noun: "service" },
    create_customers: { key: "customers", endpoint: "/api/customers", link: "/customers", noun: "customer" },
  };
  const bulk = BULK[action.tool];
  if (bulk) {
    const items = ((action.payload as Record<string, any[]>)[bulk.key]) ?? [];
    const names: string[] = [];
    const errors: string[] = [];
    for (const it of items) {
      const res = await selfFetch(ctx, "POST", bulk.endpoint, it);
      if (res.ok) names.push(res.json?.data?.name ?? it.name);
      else errors.push(`${it.name}: ${errMsg(res.json, res.status)}`);
    }
    const ok = errors.length === 0;
    return {
      ok,
      data: { success: ok, created: names.length, failed: errors.length, names, errors },
      summary: `Created ${names.length} ${bulk.noun}(s)${errors.length ? `, ${errors.length} failed` : ""}`,
      documentLink: bulk.link,
      documentLabel: `${names.length} ${bulk.noun}s`,
    };
  }

  const r = await selfFetch(ctx, action.method, action.endpoint, action.payload);
  if (!r.ok) {
    const message = errMsg(r.json, r.status);
    return { ok: false, data: { error: message }, summary: message };
  }
  const data = r.json.data;

  switch (action.tool) {
    case "create_quotation":
    case "update_quotation": {
      const verb = action.tool === "create_quotation" ? "Created" : "Updated";
      return {
        ok: true,
        data: { success: true, id: data._id, quotation_no: data.quotation_no, total_amount: data.total_amount, status: data.status },
        summary: `${verb} ${data.quotation_no}`,
        documentLink: `/quotations/${data._id}`,
        documentLabel: data.quotation_no,
        card: {
          type: "quotation",
          link: `/quotations/${data._id}`,
          label: data.quotation_no,
          subtitle: data.customer_name,
          amount: data.total_amount,
          currency: data.currency,
          status: data.status,
        },
      };
    }
    case "create_invoice":
    case "update_invoice": {
      const verb = action.tool === "create_invoice" ? "Created" : "Updated";
      return {
        ok: true,
        data: { success: true, id: data._id, invoice_no: data.invoice_no, total_amount: data.total_amount, outstanding: data.outstanding, status: data.status },
        summary: `${verb} ${data.invoice_no}`,
        documentLink: `/invoices/${data._id}`,
        documentLabel: data.invoice_no,
        card: {
          type: "invoice",
          link: `/invoices/${data._id}`,
          label: data.invoice_no,
          subtitle: data.customer_name,
          amount: data.total_amount,
          currency: data.currency,
          status: data.payment_status ?? data.status,
        },
      };
    }
    case "convert_quotation": {
      const invoice = data.invoice ?? {};
      const quotation = data.quotation ?? {};
      return {
        ok: true,
        data: { success: true, invoice_no: invoice.invoice_no, invoice_id: invoice._id, from_quotation: quotation.quotation_no },
        summary: `Converted ${quotation.quotation_no} → ${invoice.invoice_no}`,
        documentLink: `/invoices/${invoice._id}`,
        documentLabel: invoice.invoice_no,
        card: {
          type: "invoice",
          link: `/invoices/${invoice._id}`,
          label: invoice.invoice_no,
          subtitle: invoice.customer_name,
          amount: invoice.total_amount,
          currency: invoice.currency,
          status: invoice.payment_status ?? invoice.status,
        },
      };
    }
    case "record_payment": {
      return {
        ok: true,
        data: { success: true, invoice_no: data.invoice_no, outstanding: data.outstanding, payment_status: data.payment_status },
        summary: `Payment recorded — outstanding ${fmt(data.outstanding ?? 0, data.currency ?? ctx.defaultCurrency)}`,
        documentLink: `/invoices/${data._id}`,
        documentLabel: data.invoice_no,
        card: {
          type: "invoice",
          link: `/invoices/${data._id}`,
          label: data.invoice_no,
          subtitle: data.customer_name,
          amount: data.outstanding,
          currency: data.currency,
          status: data.payment_status,
        },
      };
    }
    case "create_customer": {
      return {
        ok: true,
        data: {
          success: true,
          id: data._id,
          name: data.name,
          phone_no: data.phone_no,
          // Deterministic nudge: the model tends to stop here and ask the user to
          // re-send the document details. Tell it, in-context, to keep going.
          next_step: `Customer "${data.name}" now exists with customer_id "${data._id}". If the user earlier asked to create an invoice, quotation, or project for this customer, CONTINUE NOW in this same turn: call the matching create tool with customer_id "${data._id}" and the items, quantities, prices and currency they already gave earlier in this conversation. Do NOT ask the user to repeat or re-send anything. If they only asked to add a customer, just confirm it's done.`,
        },
        summary: `Created customer ${data.name}`,
        documentLink: `/customers/${data._id}`,
        documentLabel: data.name,
        card: {
          type: "customer",
          link: `/customers/${data._id}`,
          label: data.name,
          subtitle: data.phone_no,
        },
      };
    }
    case "create_product":
    case "update_product": {
      const verb = action.tool === "create_product" ? "Created" : "Updated";
      return {
        ok: true,
        data: { success: true, id: data._id, name: data.name, default_price: data.default_price, stock_qty: data.stock_qty },
        summary: `${verb} product ${data.name}`,
        documentLink: "/products",
        documentLabel: data.name,
      };
    }
    case "create_service":
    case "update_service": {
      const verb = action.tool === "create_service" ? "Created" : "Updated";
      return {
        ok: true,
        data: { success: true, id: data._id, name: data.name, default_price: data.default_price },
        summary: `${verb} service ${data.name}`,
        documentLink: "/services",
        documentLabel: data.name,
      };
    }
    case "create_project": {
      return {
        ok: true,
        data: { success: true, id: data._id, name: data.name, project_no: data.project_no },
        summary: `Created project ${data.name}`,
        documentLink: `/projects/${data._id}`,
        documentLabel: data.project_no ?? data.name,
      };
    }
    case "create_expense": {
      return {
        ok: true,
        data: { success: true, id: data._id, expense_no: data.expense_no, total_amount: data.total_amount },
        summary: `Recorded expense ${data.expense_no ?? ""}`.trim(),
        documentLink: `/expenses/${data._id}`,
        documentLabel: data.expense_no ?? "expense",
      };
    }
    case "update_project": {
      return {
        ok: true,
        data: { success: true, id: data._id, name: data.name, project_no: data.project_no, status: data.status },
        summary: `Updated project ${data.project_no ?? data.name}`,
        documentLink: `/projects/${data._id}`,
        documentLabel: data.project_no ?? data.name,
      };
    }
    case "update_customer": {
      return {
        ok: true,
        data: { success: true, id: data._id, name: data.name, phone_no: data.phone_no },
        summary: `Updated customer ${data.name}`,
        documentLink: `/customers/${data._id}`,
        documentLabel: data.name,
        card: { type: "customer", link: `/customers/${data._id}`, label: data.name, subtitle: data.phone_no },
      };
    }
    case "update_expense": {
      return {
        ok: true,
        data: { success: true, id: data._id, expense_no: data.expense_no, status: data.status },
        summary: `Updated expense ${data.expense_no ?? ""}`.trim(),
        documentLink: `/expenses/${data._id}`,
        documentLabel: data.expense_no ?? "expense",
      };
    }
    case "add_project_attachment": {
      const pid = action.endpoint.match(/\/projects\/([^/]+)\//)?.[1];
      return {
        ok: true,
        data: { success: true },
        summary: "Image attached to the project",
        ...(pid ? { documentLink: `/projects/${pid}`, documentLabel: "project" } : {}),
      };
    }
    case "add_project_time_log": {
      return {
        ok: true,
        data: { success: true, id: data?._id, hours: data?.hours },
        summary: `Logged ${data?.hours ?? ""}h on the project`.replace(/\s+/g, " ").trim(),
        ...(data?.project_id ? { documentLink: `/projects/${data.project_id}`, documentLabel: "project" } : {}),
      };
    }
    default:
      return { ok: true, data: { success: true }, summary: "Done" };
  }
}
