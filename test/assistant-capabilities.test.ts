/**
 * End-to-end verification of EVERY assistant capability.
 * Drives the real executor (read tools + build/run write tools). A fetch shim
 * routes the executor's self-calls to the actual Next route handlers against the
 * in-memory Mongo — so every tool exercises its real logic, route and DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { executeReadTool, buildPendingAction, runPendingAction } from "@/lib/assistant/executor";
import { enabledToolSet } from "@/lib/assistant/features";
import type { ToolContext } from "@/lib/assistant/types";

import * as Customers from "@/app/api/customers/route";
import * as CustomerId from "@/app/api/customers/[id]/route";
import * as Products from "@/app/api/products/route";
import * as ProductId from "@/app/api/products/[id]/route";
import * as Services from "@/app/api/services/route";
import * as ServiceId from "@/app/api/services/[id]/route";
import * as Quotations from "@/app/api/quotations/route";
import * as QuotationId from "@/app/api/quotations/[id]/route";
import * as Convert from "@/app/api/quotations/[id]/convert/route";
import * as Invoices from "@/app/api/invoices/route";
import * as InvoiceId from "@/app/api/invoices/[id]/route";
import * as Payments from "@/app/api/invoices/[id]/payments/route";
import * as Projects from "@/app/api/projects/route";
import * as ProjectId from "@/app/api/projects/[id]/route";
import * as Expenses from "@/app/api/expenses/route";
import * as ExpenseId from "@/app/api/expenses/[id]/route";
import * as Dashboard from "@/app/api/dashboard/route";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = "http://localhost:3000";
const ctx: ToolContext = {
  cookie: "test=1", baseUrl: BASE, role: "admin", defaultCurrency: "PKR", attachments: [], enabledTools: enabledToolSet(undefined),
};

// path → { METHOD: handler }. Nested (convert/payments) listed before bare :id.
const routes: { re: RegExp; h: Record<string, any> }[] = [
  { re: /^\/api\/customers$/, h: { GET: Customers.GET, POST: Customers.POST } },
  { re: /^\/api\/customers\/([^/]+)$/, h: { GET: CustomerId.GET, PUT: CustomerId.PUT, DELETE: CustomerId.DELETE } },
  { re: /^\/api\/products$/, h: { GET: Products.GET, POST: Products.POST } },
  { re: /^\/api\/products\/([^/]+)$/, h: { GET: ProductId.GET, PUT: ProductId.PUT, DELETE: ProductId.DELETE } },
  { re: /^\/api\/services$/, h: { GET: Services.GET, POST: Services.POST } },
  { re: /^\/api\/services\/([^/]+)$/, h: { PUT: ServiceId.PUT, DELETE: ServiceId.DELETE } },
  { re: /^\/api\/quotations\/([^/]+)\/convert$/, h: { POST: Convert.POST } },
  { re: /^\/api\/quotations$/, h: { GET: Quotations.GET, POST: Quotations.POST } },
  { re: /^\/api\/quotations\/([^/]+)$/, h: { GET: QuotationId.GET, PUT: QuotationId.PUT, DELETE: QuotationId.DELETE } },
  { re: /^\/api\/invoices\/([^/]+)\/payments$/, h: { POST: Payments.POST } },
  { re: /^\/api\/invoices$/, h: { GET: Invoices.GET, POST: Invoices.POST } },
  { re: /^\/api\/invoices\/([^/]+)$/, h: { GET: InvoiceId.GET, PUT: InvoiceId.PUT, DELETE: InvoiceId.DELETE } },
  { re: /^\/api\/projects$/, h: { GET: Projects.GET, POST: Projects.POST } },
  { re: /^\/api\/projects\/([^/]+)$/, h: { GET: ProjectId.GET, PUT: ProjectId.PUT, DELETE: ProjectId.DELETE } },
  { re: /^\/api\/expenses$/, h: { GET: Expenses.GET, POST: Expenses.POST } },
  { re: /^\/api\/expenses\/([^/]+)$/, h: { GET: ExpenseId.GET, PUT: ExpenseId.PUT, DELETE: ExpenseId.DELETE } },
  { re: /^\/api\/dashboard$/, h: { GET: Dashboard.GET } },
];

let originalFetch: typeof fetch;
beforeAll(() => {
  originalFetch = global.fetch;
  global.fetch = (async (input: any, init: any) => {
    const urlStr = typeof input === "string" ? input : input.url;
    const path = new URL(urlStr).pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      const handler = r.h[method];
      if (!handler) return new Response(JSON.stringify({ success: false, error: `405 ${method} ${path}` }), { status: 405 });
      const req = new NextRequest(urlStr, { method, headers: init?.headers, body: init?.body });
      return handler(req, m[1] ? { params: Promise.resolve({ id: m[1] }) } : undefined);
    }
    return new Response(JSON.stringify({ success: false, error: `no route ${path}` }), { status: 404 });
  }) as any;
});
afterAll(() => { global.fetch = originalFetch; });

async function write(name: string, input: any): Promise<{ ok: boolean; data: any }> {
  const pending = await buildPendingAction("c", name, input, ctx);
  if ("error" in pending) throw new Error(`build(${name}) failed: ${pending.error}`);
  const r = await runPendingAction(pending, ctx);
  if (!r.ok) throw new Error(`run(${name}) failed: ${JSON.stringify(r.data)}`);
  return r as { ok: boolean; data: any };
}
const read = (name: string, input: any = {}): Promise<{ ok: boolean; data: any; summary: string }> =>
  executeReadTool(name, input, ctx) as Promise<{ ok: boolean; data: any; summary: string }>;
const makeCustomer = async (name = "Acme") => (await write("create_customer", { name, phone_no: "923001234567" })).data.id as string;

describe("assistant capabilities — every tool works end-to-end", () => {
  it("CLIENTS: create, update, list, bulk create", async () => {
    const id = await makeCustomer("Zed");
    const up = await write("update_customer", { id, company: "Zed Ltd", phone_no: "111" });
    expect(up.data.name).toBe("Zed");
    const list = await read("list_customers");
    expect(list.ok && list.data.customers.length).toBeGreaterThan(0);
    const bulk = await write("create_customers", { customers: [{ name: "B1", phone_no: "1" }, { name: "B2", phone_no: "2" }] });
    expect(bulk.data.created).toBe(2);
  });

  it("PRODUCTS: create, update, list, bulk create", async () => {
    const c = await write("create_product", { name: "Widget", default_price: 250, stock_qty: 10 });
    await write("update_product", { id: c.data.id, default_price: 300 });
    const list = await read("list_products");
    expect(list.ok && list.data.products.length).toBeGreaterThan(0);
    const bulk = await write("create_products", { products: [{ name: "P1", default_price: 5 }, { name: "P2", default_price: 6 }] });
    expect(bulk.data.created).toBe(2);
  });

  it("SERVICES: create, update, list, bulk create", async () => {
    const c = await write("create_service", { name: "Consulting", default_price: 5000 });
    await write("update_service", { id: c.data.id, default_price: 6000 });
    const list = await read("list_services");
    expect(list.ok && list.data.services.length).toBeGreaterThan(0);
    const bulk = await write("create_services", { services: [{ name: "S1" }, { name: "S2" }] });
    expect(bulk.data.created).toBe(2);
  });

  it("QUOTATIONS: create, search, get, update, convert", async () => {
    const cust = await makeCustomer("QuoteCo");
    const created = await write("create_quotation", { customer_id: cust, customer_name: "QuoteCo", items: [{ name: "Design", quantity: 2, price: 5000 }] });
    expect(created.data.quotation_no).toMatch(/^QT-\d{5}$/);
    const id = created.data.id;
    const search = await read("search_quotations");
    expect(search.ok && search.data.quotations.length).toBeGreaterThan(0);
    const got = await read("get_quotation", { id });
    expect(got.ok && got.data.quotation.number).toBe(created.data.quotation_no);
    await write("update_quotation", { id, status: "approved" });
    const conv = await write("convert_quotation", { id });
    expect(conv.data.invoice_no).toMatch(/^INV-\d{5}$/);
  });

  it("INVOICES + PAYMENTS: create, search, get, update, record payment", async () => {
    const cust = await makeCustomer("InvCo");
    const created = await write("create_invoice", { customer_id: cust, customer_name: "InvCo", items: [{ name: "Item", quantity: 1, price: 1000 }] });
    expect(created.data.invoice_no).toMatch(/^INV-\d{5}$/);
    const id = created.data.id;
    const search = await read("search_invoices");
    expect(search.ok && search.data.invoices.length).toBeGreaterThan(0);
    const got = await read("get_invoice", { id });
    expect(got.ok && got.data.invoice.number).toBe(created.data.invoice_no);
    await write("update_invoice", { id, status: "cancelled" });
    // re-create (cancelled can't take payment); pay a fresh invoice
    const inv2 = await write("create_invoice", { customer_id: cust, customer_name: "InvCo", items: [{ name: "Item", quantity: 1, price: 1000 }] });
    const pay = await write("record_payment", { invoice_id: inv2.data.id, amount: 400, method: "cash" });
    expect(pay.data.payment_status).toBe("partial");
  });

  it("PROJECTS: create, update, list", async () => {
    const cust = await makeCustomer("ProjCo");
    const created = await write("create_project", { name: "Website", customer_id: cust, customer_name: "ProjCo", budget: 50000 });
    expect(created.data.project_no).toMatch(/^PRJ-\d{5}$/);
    await write("update_project", { id: created.data.id, status: "complete", budget: 60000 });
    const list = await read("list_projects");
    expect(list.ok && list.data.projects.length).toBeGreaterThan(0);
  });

  it("EXPENSES: create, update, list", async () => {
    const created = await write("create_expense", { bill_date: "2026-06-02", vendor_name: "Fuel Co", items: [{ name: "Diesel", quantity: 10, unit_price: 300 }] });
    expect(created.data.expense_no).toMatch(/^EXP-\d{5}$/);
    await write("update_expense", { id: created.data.id, status: "verified" });
    const list = await read("list_expenses");
    expect(list.ok && list.data.expenses.length).toBeGreaterThan(0);
  });

  it("REPORTS: get_summary", async () => {
    const r = await read("get_summary");
    expect(r.ok).toBe(true);
    expect(r.data.summary).toBeDefined();
  });
});
