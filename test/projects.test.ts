import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/projects/route";
import { GET as getOne, PUT, DELETE } from "@/app/api/projects/[id]/route";
import { req, ctx, makeCustomer } from "./helpers";

async function makeProject(extra: Record<string, unknown> = {}) {
  const c = await makeCustomer();
  const r = await POST(req("/api/projects", "POST", {
    name: "Website", customer_id: c.id, customer_name: c.name, customer_phone: c.phone, budget: 50000, ...extra,
  }));
  return { c, r, j: await r.json() };
}

describe("projects CRUD", () => {
  it("POST creates a project with auto PRJ-##### number (201)", async () => {
    const { r, j } = await makeProject();
    expect(r.status).toBe(201);
    expect(j.data.project_no).toMatch(/^PRJ-\d{5}$/);
    expect(j.data.name).toBe("Website");
  });

  it("POST rejects missing name (400)", async () => {
    const c = await makeCustomer();
    const r = await POST(req("/api/projects", "POST", { customer_id: c.id, customer_name: c.name, customer_phone: c.phone }));
    expect(r.status).toBe(400);
  });

  it("GET [id] returns project + stats", async () => {
    const { j } = await makeProject();
    const r = await getOne(req(`/api/projects/${j.data._id}`), ctx(j.data._id));
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect((d.project ?? d).name).toBe("Website");
  });

  it("PUT updates status", async () => {
    const { j } = await makeProject();
    const r = await PUT(req(`/api/projects/${j.data._id}`, "PUT", { status: "complete" }), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).data.status).toBe("complete");
  });

  it("DELETE removes an unlinked project", async () => {
    const { j } = await makeProject();
    const r = await DELETE(req(`/api/projects/${j.data._id}`, "DELETE"), ctx(j.data._id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
});
