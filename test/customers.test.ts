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

describe("customer status / currency / tax_id editability", () => {
  it("defaults status to active (true) when not provided on create", async () => {
    const r = await POST(req("/api/customers", "POST", { name: "DefaultStatus", phone_no: "923001110001" }));
    expect(r.status).toBe(201);
    expect((await r.json()).data.status).toBe(true);
  });

  it("accepts an explicit status on create", async () => {
    const r = await POST(req("/api/customers", "POST", { name: "Dormant", phone_no: "923001110002", status: false }));
    expect(r.status).toBe(201);
    expect((await r.json()).data.status).toBe(false);
  });

  it("PUT toggles status active → inactive and back", async () => {
    const c = await makeCustomer("Toggle", "923001110003");

    const off = await PUT(req(`/api/customers/${c.id}`, "PUT", { status: false }), ctx(c.id));
    expect(off.status).toBe(200);
    expect((await off.json()).data.status).toBe(false);

    const on = await PUT(req(`/api/customers/${c.id}`, "PUT", { status: true }), ctx(c.id));
    expect(on.status).toBe(200);
    expect((await on.json()).data.status).toBe(true);
  });

  it("PUT updates currency, tax_id and notes together", async () => {
    const c = await makeCustomer("FullEdit", "923001110004");
    const r = await PUT(
      req(`/api/customers/${c.id}`, "PUT", { currency: "USD", tax_id: "1234567-8", notes: "VIP client" }),
      ctx(c.id),
    );
    expect(r.status).toBe(200);
    const d = (await r.json()).data;
    expect(d.currency).toBe("USD");
    expect(d.tax_id).toBe("1234567-8");
    expect(d.notes).toBe("VIP client");
  });

  it("PUT rejects a non-boolean status (400)", async () => {
    const c = await makeCustomer("BadStatus", "923001110005");
    const r = await PUT(req(`/api/customers/${c.id}`, "PUT", { status: "active" }), ctx(c.id));
    expect(r.status).toBe(400);
    expect((await r.json()).success).toBe(false);
  });

  it("GET list filters by status=active and status=inactive", async () => {
    await POST(req("/api/customers", "POST", { name: "ActiveA", phone_no: "923001110006", status: true }));
    await POST(req("/api/customers", "POST", { name: "InactiveB", phone_no: "923001110007", status: false }));

    const active = await list(req("/api/customers?status=active"));
    const activeData = (await active.json()).data;
    expect(activeData).toHaveLength(1);
    expect(activeData[0].name).toBe("ActiveA");

    const inactive = await list(req("/api/customers?status=inactive"));
    const inactiveData = (await inactive.json()).data;
    expect(inactiveData).toHaveLength(1);
    expect(inactiveData[0].name).toBe("InactiveB");
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
