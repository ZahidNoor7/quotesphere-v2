import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { runWithOrg } from "@/lib/tenant-context";
import Product from "@/models/Product";
import Settings from "@/models/Settings";
import Invoice from "@/models/Invoice";
import { POST as createProduct } from "@/app/api/products/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/settings/route";
import { isSafeExternalUrl } from "@/lib/ssrf-guard";
import { req, setSession } from "./helpers";

const ORG_A = "0000000000000000000000aa";
const ORG_B = "0000000000000000000000bb";
const adminOf = (org: string) => ({ user: { id: "0000000000000000000000a1", role: "admin", org_id: org } });
const roleOf = (role: string, org = ORG_A) => ({ user: { id: "0000000000000000000000a2", role, org_id: org } });

describe("R1 — cross-tenant write is blocked (org_id mass-assignment)", () => {
  it("plugin FORCE-stamps org_id on create, overriding a caller-supplied value", async () => {
    const p = await runWithOrg(ORG_A, async () =>
      // Try to plant the doc in ORG_B by supplying org_id directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Product.create({ name: "X", org_id: new mongoose.Types.ObjectId(ORG_B) } as any),
    );
    expect(String(p.org_id)).toBe(ORG_A); // stamped to the context org, NOT B
  });

  it("POST /api/products ignores a body org_id and creates in the caller's org", async () => {
    await setSession(adminOf(ORG_A));
    const res = await createProduct(req("/api/products", "POST", { name: "Widget", org_id: ORG_B }));
    expect(res.status).toBe(201);
    const id = (await res.json()).data._id as string;

    const inB = await runWithOrg(ORG_B, async () => await Product.findById(id).lean());
    expect(inB).toBeNull(); // never leaked into ORG_B
    const inA = await runWithOrg(ORG_A, async () => await Product.findById(id).lean());
    expect(inA).not.toBeNull(); // stayed in ORG_A
  });

  it("the `new Model().save()` path also force-stamps org_id (not just .create())", async () => {
    const inv = await runWithOrg(ORG_A, async () => {
      const doc = new Invoice({
        issue_date: new Date(), status: "issued",
        items: [{ id: 1, name: "x", quantity: 1, price: 1 }],
        sub_total: 1, total_amount: 1,
        customer_id: new mongoose.Types.ObjectId(), customer_name: "x", customer_phone: "x",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        org_id: new mongoose.Types.ObjectId(ORG_B),
      } as any);
      await doc.save();
      return doc;
    });
    expect(String(inv.org_id)).toBe(ORG_A); // validate hook stamped the context org, not B
  });
});

describe("R2 — RBAC is enforced on writes", () => {
  it("a viewer cannot create a product (403)", async () => {
    await setSession(roleOf("viewer"));
    const res = await createProduct(req("/api/products", "POST", { name: "Nope" }));
    expect(res.status).toBe(403);
  });

  it("a viewer cannot modify settings (admin-only, 403)", async () => {
    await setSession(roleOf("viewer"));
    const res = await putSettings(req("/api/settings", "PUT", { company_name: "Hacked" }));
    expect(res.status).toBe(403);
  });

  it("a manager cannot modify settings (settings are admin-only, 403)", async () => {
    await setSession(roleOf("manager"));
    const res = await putSettings(req("/api/settings", "PUT", { company_name: "Hacked" }));
    expect(res.status).toBe(403);
  });

  it("an admin CAN modify settings", async () => {
    await setSession(adminOf(ORG_A));
    const res = await putSettings(req("/api/settings", "PUT", { company_name: "Acme" }));
    expect(res.status).toBe(200);
  });
});

describe("R3 — integration secrets never leave the server", () => {
  it("GET /api/settings masks secret fields", async () => {
    await runWithOrg(ORG_A, async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Settings.create({ integrations: { email: { enabled: true, apiKey: "re_supersecret_123" } } } as any),
    );
    await setSession(adminOf(ORG_A));
    const json = await (await getSettings(req("/api/settings"))).json();
    expect(json.data.integrations.email.apiKey).not.toBe("re_supersecret_123");
    expect(json.data.emailConfigured).toBe(true); // boolean flag still surfaced
  });

  it("a non-admin CAN persist display preferences (appearance) but NOT company config", async () => {
    await setSession(roleOf("staff"));
    const okPref = await putSettings(req("/api/settings", "PUT", { appearance: { theme: "dark" } }));
    expect(okPref.status).toBe(200); // preference write allowed for any member
    const blocked = await putSettings(req("/api/settings", "PUT", { company_name: "X" }));
    expect(blocked.status).toBe(403); // company config stays admin-only
  });

  it("PUT /api/settings does not clobber a stored secret when the masked value is echoed back", async () => {
    await runWithOrg(ORG_A, async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Settings.create({ integrations: { email: { enabled: true, apiKey: "re_keep_me" } } } as any),
    );
    await setSession(adminOf(ORG_A));
    // Client submits the masked sentinel (unchanged) → stored secret must survive.
    await putSettings(req("/api/settings", "PUT", { integrations: { email: { apiKey: "••••••••" } } }));
    const stored = await runWithOrg(ORG_A, async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Settings.findOne({}).lean() as any,
    );
    expect(stored.integrations.email.apiKey).toBe("re_keep_me");
  });

  it("PUT /api/settings response also masks secrets (never echoes plaintext)", async () => {
    await setSession(adminOf(ORG_A));
    const res = await putSettings(req("/api/settings", "PUT", { integrations: { email: { enabled: true, apiKey: "re_new_secret_999" } } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.integrations.email.apiKey).not.toBe("re_new_secret_999"); // masked in the echo-back
    // …but it was actually stored (write succeeded).
    const stored = await runWithOrg(ORG_A, async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Settings.findOne({}).lean() as any,
    );
    expect(stored.integrations.email.apiKey).toBe("re_new_secret_999");
  });

  it("GET /api/settings preserves the document _id (masking doesn't mangle ObjectIds)", async () => {
    const doc = await runWithOrg(ORG_A, async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Settings.create({ company_name: "Acme" } as any),
    );
    await setSession(adminOf(ORG_A));
    const json = await (await getSettings(req("/api/settings"))).json();
    expect(String(json.data._id)).toBe(String(doc._id)); // ObjectId intact, not rebuilt
  });
});

describe("R9 — SSRF guard rejects internal/obfuscated hosts", () => {
  it("rejects loopback, private, link-local and metadata targets", () => {
    for (const u of [
      "http://example.com/x",            // not https
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.1.2.3/x",
      "https://192.168.0.1/x",
      "https://169.254.169.254/latest/meta-data/", // cloud metadata
      "https://[::1]/x",
      "https://2130706433/x",            // decimal 127.0.0.1
      "https://0x7f000001/x",            // hex 127.0.0.1
      "https://0177.0.0.1/x",            // octal
      "https://127.0.0.1./x",            // trailing dot
    ]) {
      expect(isSafeExternalUrl(u), u).toBe(false);
    }
  });

  it("allows normal public https endpoints", () => {
    for (const u of [
      "https://api.openai.com/v1",
      "https://my-resource.openai.azure.com",
      "https://res.cloudinary.com/demo/image/upload/x.png",
    ]) {
      expect(isSafeExternalUrl(u), u).toBe(true);
    }
  });
});
