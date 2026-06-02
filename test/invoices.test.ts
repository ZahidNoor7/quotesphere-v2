import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/invoices/route";
import { PUT, DELETE } from "@/app/api/invoices/[id]/route";
import { POST as recordPayment } from "@/app/api/invoices/[id]/payments/route";
import { POST as createProduct } from "@/app/api/products/route";
import { GET as getProduct } from "@/app/api/products/[id]/route";
import { req, ctx, makeCustomer } from "./helpers";

async function makeInvoice(
  items: Array<Record<string, unknown>>,
  totals: { sub_total: number; total_amount: number },
  extra: Record<string, unknown> = {},
) {
  const c = await makeCustomer();
  const r = await POST(req("/api/invoices", "POST", {
    customer_id: c.id, customer_name: c.name, customer_phone: c.phone,
    issue_date: null, items, ...totals, ...extra,
  }));
  return { c, r, j: await r.json() };
}

describe("invoices CRUD + payments + stock", () => {
  it("POST creates an invoice with auto INV-##### number (201)", async () => {
    const { r, j } = await makeInvoice([{ id: 1, name: "Item", quantity: 1, price: 1000 }], { sub_total: 1000, total_amount: 1000 });
    expect(r.status).toBe(201);
    expect(j.data.invoice_no).toMatch(/^INV-\d{5}$/);
    expect(j.data.outstanding).toBe(1000);
  });

  it("decrements product stock for product line items", async () => {
    const prod = (await (await createProduct(req("/api/products", "POST", { name: "Widget", default_price: 100, stock_qty: 10 }))).json()).data;
    await makeInvoice([{ id: 1, name: "Widget", quantity: 3, price: 100, product_id: prod._id }], { sub_total: 300, total_amount: 300 });
    const after = await getProduct(req(`/api/products/${prod._id}`), ctx(prod._id));
    expect((await after.json()).data.stock_qty).toBe(7);
  });

  it("records a payment → outstanding & payment_status update", async () => {
    const { j } = await makeInvoice([{ id: 1, name: "Item", quantity: 1, price: 1000 }], { sub_total: 1000, total_amount: 1000 });
    const pay = await recordPayment(req(`/api/invoices/${j.data._id}/payments`, "POST", { amount: 400, method: "cash" }), ctx(j.data._id));
    expect(pay.status).toBe(200);
    const d = (await pay.json()).data;
    expect(d.outstanding).toBe(600);
    expect(d.payment_status).toBe("partial");
  });

  it("rejects an overpayment (400)", async () => {
    const { j } = await makeInvoice([{ id: 1, name: "Item", quantity: 1, price: 500 }], { sub_total: 500, total_amount: 500 });
    const pay = await recordPayment(req(`/api/invoices/${j.data._id}/payments`, "POST", { amount: 9999 }), ctx(j.data._id));
    expect(pay.status).toBe(400);
  });

  it("PUT updates the invoice", async () => {
    const { j } = await makeInvoice([{ id: 1, name: "Item", quantity: 1, price: 100 }], { sub_total: 100, total_amount: 100 });
    const r = await PUT(req(`/api/invoices/${j.data._id}`, "PUT", { status: "cancelled" }), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).data.status).toBe("cancelled");
  });

  it("DELETE removes an invoice", async () => {
    const { j } = await makeInvoice([{ id: 1, name: "Item", quantity: 1, price: 100 }], { sub_total: 100, total_amount: 100 });
    const r = await DELETE(req(`/api/invoices/${j.data._id}`, "DELETE"), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
});
