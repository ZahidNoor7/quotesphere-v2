import { describe, it, expect } from "vitest";
import { GET as list, POST } from "@/app/api/services/route";
import { PUT, DELETE } from "@/app/api/services/[id]/route";
import { req, ctx } from "./helpers";

async function makeService(body: Record<string, unknown>) {
  const r = await POST(req("/api/services", "POST", body));
  return { r, j: await r.json() };
}

describe("services CRUD", () => {
  it("POST creates a service (201)", async () => {
    const { r, j } = await makeService({ name: "Consulting", default_price: 5000, category: "Pro" });
    expect(r.status).toBe(201);
    expect(j.data.name).toBe("Consulting");
    expect(j.data.default_price).toBe(5000);
  });

  it("POST rejects missing name (400)", async () => {
    const { r } = await makeService({ default_price: 1 });
    expect(r.status).toBe(400);
  });

  it("GET list returns services", async () => {
    await makeService({ name: "A" });
    await makeService({ name: "B" });
    const r = await list(req("/api/services"));
    expect((await r.json()).data).toHaveLength(2);
  });

  it("PUT updates a service", async () => {
    const { j } = await makeService({ name: "Old", default_price: 1 });
    const r = await PUT(req(`/api/services/${j.data._id}`, "PUT", { name: "New", default_price: 99 }), ctx(j.data._id));
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect(d.name).toBe("New");
    expect(d.default_price).toBe(99);
  });

  it("DELETE removes a service", async () => {
    const { j } = await makeService({ name: "Gone" });
    const r = await DELETE(req(`/api/services/${j.data._id}`, "DELETE"), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
});
