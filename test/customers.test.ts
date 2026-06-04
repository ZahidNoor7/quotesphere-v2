import { describe, it, expect } from "vitest";
import { GET as list, POST } from "@/app/api/customers/route";
import { GET as getOne, PUT, DELETE } from "@/app/api/customers/[id]/route";
import { POST as createInvoice } from "@/app/api/invoices/route";
import { req, ctx, setSession, makeCustomer } from "./helpers";

describe("customers CRUD", () => {
  it("POST creates a customer (201)", async () => {
    const r = await POST(req("/api/customers", "POST", { name: "Acme", phone_no: "923001112222", email: "a@acme.com" }));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.data.name).toBe("Acme");
    expect(j.data.phone_no).toBe("923001112222");
  });

  it("POST rejects missing required fields (400)", async () => {
    const r = await POST(req("/api/customers", "POST", { name: "" }));
    expect(r.status).toBe(400);
    expect((await r.json()).success).toBe(false);
  });

  it("GET list returns created customers", async () => {
    await makeCustomer("One");
    await makeCustomer("Two");
    const r = await list(req("/api/customers"));
    expect(r.status).toBe(200);
    expect((await r.json()).data).toHaveLength(2);
  });

  it("GET [id] returns the customer + stats", async () => {
    const c = await makeCustomer("Bob");
    const r = await getOne(req(`/api/customers/${c.id}`), ctx(c.id));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.data.customer.name).toBe("Bob");
    expect(j.data.stats).toBeDefined();
  });

  it("PUT updates a customer", async () => {
    const c = await makeCustomer("Bob");
    const r = await PUT(req(`/api/customers/${c.id}`, "PUT", { name: "Bobby" }), ctx(c.id));
    expect(r.status).toBe(200);
    expect((await r.json()).data.name).toBe("Bobby");
  });

  it("DELETE removes an unlinked customer", async () => {
    const c = await makeCustomer("Temp");
    const r = await DELETE(req(`/api/customers/${c.id}`, "DELETE"), ctx(c.id));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });

  it("DELETE is blocked (409) when linked, allowed with force=true", async () => {
    const c = await makeCustomer("Linked");
    await createInvoice(req("/api/invoices", "POST", {
      customer_id: c.id, customer_name: c.name, customer_phone: c.phone,
      issue_date: null, items: [{ id: 1, name: "x", quantity: 1, price: 100 }], sub_total: 100, total_amount: 100,
    }));
    const blocked = await DELETE(req(`/api/customers/${c.id}`, "DELETE"), ctx(c.id));
    expect(blocked.status).toBe(409);
    const forced = await DELETE(req(`/api/customers/${c.id}?force=true`, "DELETE"), ctx(c.id));
    expect(forced.status).toBe(200);
  });

  it("returns 401 without a session", async () => {
    await setSession(null);
    const r = await POST(req("/api/customers", "POST", { name: "x", phone_no: "1" }));
    expect(r.status).toBe(401);
  });

  it("returns 403 for a viewer (no create permission)", async () => {
    await setSession({ user: { id: "v", role: "viewer" } });
    const r = await POST(req("/api/customers", "POST", { name: "x", phone_no: "1" }));
    expect(r.status).toBe(403);
  });
});

describe("role permissions — manager delete access", () => {
  it("a manager CAN delete a record", async () => {
    const c = await makeCustomer("DelMe", "923009990000");
    await setSession({ user: { id: "m", role: "manager" } });
    const r = await DELETE(req(`/api/customers/${c.id}`, "DELETE"), ctx(c.id));
    expect(r.status).toBe(200);
  });

  it("a staff member CANNOT delete (403)", async () => {
    const c = await makeCustomer("KeepMe", "923009990001");
    await setSession({ user: { id: "s", role: "staff" } });
    const r = await DELETE(req(`/api/customers/${c.id}`, "DELETE"), ctx(c.id));
    expect(r.status).toBe(403);
  });
});
