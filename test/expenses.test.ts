import { describe, it, expect } from "vitest";
import { GET as list, POST } from "@/app/api/expenses/route";
import { PUT, DELETE } from "@/app/api/expenses/[id]/route";
import { req, ctx } from "./helpers";

async function makeExpense(extra: Record<string, unknown> = {}) {
  const r = await POST(req("/api/expenses", "POST", {
    bill_date: "2026-06-02", vendor_name: "Fuel Co",
    items: [{ id: 1, name: "Diesel", quantity: 10, unit_price: 300, total: 3000 }],
    tax: 0, ...extra,
  }));
  return { r, j: await r.json() };
}

describe("expenses CRUD", () => {
  it("POST creates an expense with computed totals + auto EXP-##### (201)", async () => {
    const { r, j } = await makeExpense();
    expect(r.status).toBe(201);
    expect(j.data.expense_no).toMatch(/^EXP-\d{5}$/);
    expect(j.data.sub_total).toBe(3000);
    expect(j.data.total_amount).toBe(3000);
  });

  it("folds percentage tax into total_amount", async () => {
    const { j } = await makeExpense({ tax: 10, tax_type: "percentage" });
    expect(j.data.sub_total).toBe(3000);
    expect(j.data.total_amount).toBe(3300);
  });

  it("GET list returns expenses", async () => {
    await makeExpense();
    await makeExpense();
    const r = await list(req("/api/expenses"));
    expect((await r.json()).data).toHaveLength(2);
  });

  it("PUT updates status", async () => {
    const { j } = await makeExpense();
    const r = await PUT(req(`/api/expenses/${j.data._id}`, "PUT", { status: "verified" }), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).data.status).toBe("verified");
  });

  it("DELETE removes an expense", async () => {
    const { j } = await makeExpense();
    const r = await DELETE(req(`/api/expenses/${j.data._id}`, "DELETE"), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
});
