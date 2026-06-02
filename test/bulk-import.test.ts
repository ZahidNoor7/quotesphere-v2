import { describe, it, expect } from "vitest";
import { POST as productsBulk } from "@/app/api/products/bulk/route";
import { GET as listProducts } from "@/app/api/products/route";
import { POST as servicesBulk } from "@/app/api/services/bulk/route";
import { GET as listServices } from "@/app/api/services/route";
import { req } from "./helpers";

describe("products bulk import", () => {
  it("creates rows, maps column aliases, coerces numbers", async () => {
    const res = await productsBulk(req("/api/products/bulk", "POST", {
      rows: [
        { Name: "Widget A", Price: "250", Stock: "10", SKU: "W-A" },
        { name: "Widget B", rate: "99.5", qty: "3" },
      ],
    }));
    expect(res.status).toBe(200);
    const d = (await res.json()).data;
    expect(d.created).toBe(2);

    const list = (await (await listProducts(req("/api/products"))).json()).data;
    const a = list.find((p: any) => p.name === "Widget A");
    expect(a.default_price).toBe(250); // coerced from "250"
    expect(a.stock_qty).toBe(10);
  });

  it("skips duplicates (by SKU, then name)", async () => {
    await productsBulk(req("/api/products/bulk", "POST", { rows: [{ name: "Dup", sku: "S1", price: "5" }] }));
    const res = await productsBulk(req("/api/products/bulk", "POST", { rows: [{ name: "Other", sku: "S1", price: "5" }] }));
    const d = (await res.json()).data;
    expect(d.skipped).toBe(1);
    expect(d.created).toBe(0);
  });

  it("reports error rows (missing name) without aborting the batch", async () => {
    const res = await productsBulk(req("/api/products/bulk", "POST", { rows: [{ price: "5" }, { name: "OK", price: "3" }] }));
    const d = (await res.json()).data;
    expect(d.errors).toBe(1);
    expect(d.created).toBe(1);
  });
});

describe("services bulk import", () => {
  it("creates rows with aliases", async () => {
    const res = await servicesBulk(req("/api/services/bulk", "POST", {
      rows: [{ Name: "Consulting", Price: "5000", Category: "Pro" }, { name: "Design", rate: "3000" }],
    }));
    expect(res.status).toBe(200);
    const d = (await res.json()).data;
    expect(d.created).toBe(2);
    const list = (await (await listServices(req("/api/services"))).json()).data;
    expect(list.find((s: any) => s.name === "Consulting").default_price).toBe(5000);
  });

  it("skips duplicate names", async () => {
    await servicesBulk(req("/api/services/bulk", "POST", { rows: [{ name: "Audit" }] }));
    const res = await servicesBulk(req("/api/services/bulk", "POST", { rows: [{ name: "Audit" }] }));
    expect((await res.json()).data.skipped).toBe(1);
  });
});
