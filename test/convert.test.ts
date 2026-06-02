import { describe, it, expect } from "vitest";
import { POST as createQuotation } from "@/app/api/quotations/route";
import { POST as convert } from "@/app/api/quotations/[id]/convert/route";
import { req, ctx, makeCustomer } from "./helpers";

describe("quotation → invoice convert", () => {
  it("converts a quotation into an invoice and marks it invoiced", async () => {
    const c = await makeCustomer();
    const quot = (await (await createQuotation(req("/api/quotations", "POST", {
      customer_id: c.id, customer_name: c.name, customer_phone: c.phone,
      issue_date: null, items: [{ id: 1, name: "Work", quantity: 1, price: 10000 }],
      sub_total: 10000, total_amount: 10000,
    }))).json()).data;

    const r = await convert(req(`/api/quotations/${quot._id}/convert`, "POST", {}), ctx(quot._id));
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect(d.invoice.invoice_no).toMatch(/^INV-\d{5}$/);
    expect(d.invoice.total_amount).toBe(10000);
    expect(d.quotation.status).toBe("invoiced");
  });

  it("rejects converting an already-converted quotation (400)", async () => {
    const c = await makeCustomer();
    const quot = (await (await createQuotation(req("/api/quotations", "POST", {
      customer_id: c.id, customer_name: c.name, customer_phone: c.phone,
      issue_date: null, items: [{ id: 1, name: "Work", quantity: 1, price: 500 }],
      sub_total: 500, total_amount: 500,
    }))).json()).data;
    await convert(req(`/api/quotations/${quot._id}/convert`, "POST", {}), ctx(quot._id));
    const again = await convert(req(`/api/quotations/${quot._id}/convert`, "POST", {}), ctx(quot._id));
    expect(again.status).toBe(400);
  });
});
