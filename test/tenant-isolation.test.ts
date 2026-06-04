import { describe, it, expect } from "vitest";
import { runWithOrg } from "@/lib/tenant-context";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import { GET as listCustomers } from "@/app/api/customers/route";
import { GET as getCustomer, PUT as putCustomer, DELETE as delCustomer } from "@/app/api/customers/[id]/route";
import { GET as listInvoices } from "@/app/api/invoices/route";
import { req, ctx, setSession } from "./helpers";

// Two distinct organizations. These are NOT the default test org, so anything
// the route returns is proof of real per-org scoping (not the fallback).
const ORG_A = "0000000000000000000000aa";
const ORG_B = "0000000000000000000000bb";

const adminOf = (org: string) => ({ user: { id: "0000000000000000000000a1", role: "admin", org_id: org } });

const seedCustomer = (org: string, name: string) =>
  runWithOrg(org, () => Customer.create({ name, phone_no: `+92300${name}` }));

const seedInvoice = (org: string, customerId: string) =>
  runWithOrg(org, () =>
    Invoice.create({
      issue_date: new Date(),
      status: "issued",
      items: [{ id: 1, name: "Item", quantity: 1, price: 100 }],
      sub_total: 100,
      total_amount: 100,
      customer_id: customerId,
      customer_name: "x",
      customer_phone: "x",
    }),
  );

describe("multi-tenant data isolation (org A cannot reach org B)", () => {
  it("list endpoints return only the caller's org", async () => {
    await seedCustomer(ORG_A, "Aaa");
    await seedCustomer(ORG_B, "Bbb");
    await setSession(adminOf(ORG_A));

    const data = (await (await listCustomers(req("/api/customers"))).json()).data as Array<{ name: string }>;
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Aaa");
  });

  it("GET by id 404s for another org's document (IDOR blocked)", async () => {
    const bCust = await seedCustomer(ORG_B, "Bbb");
    await setSession(adminOf(ORG_A));

    const res = await getCustomer(req(`/api/customers/${bCust._id}`), ctx(String(bCust._id)));
    expect(res.status).toBe(404);
  });

  it("PUT cannot modify another org's document", async () => {
    const bCust = await seedCustomer(ORG_B, "Bbb");
    await setSession(adminOf(ORG_A));

    const res = await putCustomer(req(`/api/customers/${bCust._id}`, "PUT", { name: "HACKED" }), ctx(String(bCust._id)));
    expect(res.status).toBe(404);

    // B's record is untouched. (await inside the callback so the query runs in-context.)
    const stillThere = await runWithOrg(ORG_B, async () => await Customer.findById(bCust._id).lean());
    expect((stillThere as { name: string }).name).toBe("Bbb");
  });

  it("DELETE cannot remove another org's document", async () => {
    const bCust = await seedCustomer(ORG_B, "Bbb");
    await setSession(adminOf(ORG_A));

    await delCustomer(req(`/api/customers/${bCust._id}`, "DELETE"), ctx(String(bCust._id)));

    const stillThere = await runWithOrg(ORG_B, async () => await Customer.findById(bCust._id).lean());
    expect(stillThere).not.toBeNull();
  });

  it("invoice list is org-scoped", async () => {
    const aCust = await seedCustomer(ORG_A, "Aaa");
    const bCust = await seedCustomer(ORG_B, "Bbb");
    await seedInvoice(ORG_A, String(aCust._id));
    await seedInvoice(ORG_B, String(bCust._id));
    await setSession(adminOf(ORG_A));

    const data = (await (await listInvoices(req("/api/invoices"))).json()).data as unknown[];
    expect(data).toHaveLength(1);
  });

  it("per-org invoice numbering does not collide across orgs", async () => {
    const aCust = await seedCustomer(ORG_A, "Aaa");
    const bCust = await seedCustomer(ORG_B, "Bbb");
    const a1 = await seedInvoice(ORG_A, String(aCust._id));
    const b1 = await seedInvoice(ORG_B, String(bCust._id));
    // Both orgs start their own sequence — same number, different org.
    expect((a1 as { invoice_no: string }).invoice_no).toBe((b1 as { invoice_no: string }).invoice_no);
  });

  it("a session without an org is rejected (401)", async () => {
    const { auth } = await import("@/auth");
    (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ user: { id: "x", role: "admin" } });
    const res = await listCustomers(req("/api/customers"));
    expect(res.status).toBe(401);
  });
});
