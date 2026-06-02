import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/quotations/route";
import { GET as getOne, PUT, DELETE } from "@/app/api/quotations/[id]/route";
import { req, ctx, makeCustomer } from "./helpers";

async function makeQuotation(extra: Record<string, unknown> = {}) {
  const c = await makeCustomer();
  const r = await POST(req("/api/quotations", "POST", {
    customer_id: c.id, customer_name: c.name, customer_phone: c.phone,
    issue_date: null,
    items: [{ id: 1, name: "Design", quantity: 2, price: 5000 }],
    sub_total: 10000, total_amount: 10000, currency: "USD",
    ...extra,
  }));
  return { c, r, j: await r.json() };
}

describe("quotations CRUD", () => {
  it("POST creates a quotation with auto QT-##### number (201)", async () => {
    const { r, j } = await makeQuotation();
    expect(r.status).toBe(201);
    expect(j.data.quotation_no).toMatch(/^QT-\d{5}$/);
    expect(j.data.total_amount).toBe(10000);
    expect(j.data.customer_name).toBe("Acme Co");
  });

  it("POST rejects empty items (400)", async () => {
    const c = await makeCustomer();
    const r = await POST(req("/api/quotations", "POST", {
      customer_id: c.id, customer_name: c.name, customer_phone: c.phone,
      issue_date: null, items: [], sub_total: 0, total_amount: 0,
    }));
    expect(r.status).toBe(400);
  });

  it("GET [id] loads the quotation", async () => {
    const { j } = await makeQuotation();
    const r = await getOne(req(`/api/quotations/${j.data._id}`), ctx(j.data._id));
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect((d.quotation ?? d).quotation_no).toMatch(/^QT-\d{5}$/);
  });

  it("PUT updates status", async () => {
    const { j } = await makeQuotation();
    const r = await PUT(req(`/api/quotations/${j.data._id}`, "PUT", { status: "approved" }), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).data.status).toBe("approved");
  });

  it("DELETE removes a quotation", async () => {
    const { j } = await makeQuotation();
    const r = await DELETE(req(`/api/quotations/${j.data._id}`, "DELETE"), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });

  it("auto-number increments across quotations", async () => {
    const a = await makeQuotation();
    const b = await makeQuotation();
    expect(a.j.data.quotation_no).not.toBe(b.j.data.quotation_no);
  });
});
