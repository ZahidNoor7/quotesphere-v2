import { describe, it, expect } from "vitest";
import { GET as list, POST } from "@/app/api/products/route";
import { GET as getOne, PUT, DELETE } from "@/app/api/products/[id]/route";
import { req, ctx } from "./helpers";

async function makeProduct(body: Record<string, unknown>) {
  const r = await POST(req("/api/products", "POST", body));
  return { r, j: await r.json() };
}

describe("products CRUD", () => {
  it("POST creates a product (201)", async () => {
    const { r, j } = await makeProduct({ name: "Widget", default_price: 250, stock_qty: 10, sku: "W-1" });
    expect(r.status).toBe(201);
    expect(j.data.name).toBe("Widget");
    expect(j.data.default_price).toBe(250);
    expect(j.data.stock_qty).toBe(10);
  });

  it("GET list returns products", async () => {
    await makeProduct({ name: "A" });
    await makeProduct({ name: "B" });
    const r = await list(req("/api/products"));
    expect(r.status).toBe(200);
    expect((await r.json()).data).toHaveLength(2);
  });

  it("GET [id] returns one product", async () => {
    const { j } = await makeProduct({ name: "Solo", default_price: 5 });
    const r = await getOne(req(`/api/products/${j.data._id}`), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).data.name).toBe("Solo");
  });

  it("PUT updates price & stock", async () => {
    const { j } = await makeProduct({ name: "Widget", default_price: 100, stock_qty: 5 });
    const r = await PUT(req(`/api/products/${j.data._id}`, "PUT", { default_price: 150, stock_qty: 8 }), ctx(j.data._id));
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect(d.default_price).toBe(150);
    expect(d.stock_qty).toBe(8);
  });

  it("DELETE removes a product", async () => {
    const { j } = await makeProduct({ name: "Gone" });
    const r = await DELETE(req(`/api/products/${j.data._id}`, "DELETE"), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
});
