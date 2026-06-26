import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { runWithOrg } from "@/lib/tenant-context";
import Customer from "@/models/Customer";
import Organization from "@/models/Organization";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import PaymentRecord from "@/models/PaymentRecord";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import { PUT as putCustomer } from "@/app/api/customers/[id]/route";
import { POST as createStructure } from "@/app/api/payroll/salary-structures/route";
import { POST as createEmployee } from "@/app/api/payroll/employees/route";
import { POST as createPeriod } from "@/app/api/payroll/pay-periods/route";
import { POST as createLoan } from "@/app/api/payroll/loans/route";
import { PUT as putLoan } from "@/app/api/payroll/loans/[id]/route";
import { POST as createRun } from "@/app/api/payroll/runs/route";
import { POST as submitRun } from "@/app/api/payroll/runs/[id]/submit/route";
import { POST as approveRun } from "@/app/api/payroll/runs/[id]/approve/route";
import { POST as markPaidRun } from "@/app/api/payroll/runs/[id]/mark-paid/route";
import { toMinor } from "@/lib/payroll/money";
import { req, ctx, setSession } from "./helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ORG_A = "0000000000000000000000aa";
const ORG_B = "0000000000000000000000bb";
const adminOf = (org: string) => ({ user: { id: "0000000000000000000000a1", role: "admin", org_id: org } });

// ─── R1 (update path): the plugin strips a client org_id from updates ─────────────
describe("R1 — cross-tenant RELOCATE via update is blocked", () => {
  it("PUT cannot move a record to another org by sending org_id in the body", async () => {
    const cust = await runWithOrg(ORG_A, async () => await Customer.create({ name: "Acme", phone_no: "1" }));
    await setSession(adminOf(ORG_A));
    await putCustomer(
      req(`/api/customers/${cust._id}`, "PUT", { name: "Renamed", org_id: ORG_B }),
      ctx(String(cust._id)),
    );
    const after = await runWithOrg(ORG_A, async () => await Customer.findById(cust._id).lean()) as any;
    expect(after).not.toBeNull();
    expect(String(after.org_id)).toBe(ORG_A); // org_id untouched — not relocated to B
    expect(after.name).toBe("Renamed");       // the legitimate field update still applied
  });
});

// ─── R7 — payroll loan ledger integrity ──────────────────────────────────────────
async function seedPayroll() {
  const structure = (await (await createStructure(req("/api/payroll/salary-structures", "POST", {
    name: "Std",
    components: [{ name: "Basic", type: "earning", calculation: "fixed", value: toMinor(100000), isBasic: true, taxable: true }],
  }))).json()).data;
  const employee = (await (await createEmployee(req("/api/payroll/employees", "POST", {
    name: "Jane", joinDate: "2025-01-01", payCurrency: "PKR", salaryStructureId: structure._id,
  }))).json()).data;
  const period = (await (await createPeriod(req("/api/payroll/pay-periods", "POST", {
    label: "June 2026", startDate: "2026-06-01", endDate: "2026-06-30", payDate: "2026-07-01",
  }))).json()).data;
  return { structure, employee, period };
}

describe("R7 — loan remainingBalance is server-only and locks after a paid payslip", () => {
  it("PUT cannot directly set remainingBalance (field is not in the editable schema)", async () => {
    await setSession(adminOf(ORG_A));
    const { employee } = await seedPayroll();
    const loan = (await (await createLoan(req("/api/payroll/loans", "POST", {
      employeeId: employee._id, principal: toMinor(50000), installmentAmount: toMinor(10000),
    }))).json()).data;
    expect(loan.remainingBalance).toBe(toMinor(50000));

    const res = await putLoan(req(`/api/payroll/loans/${loan._id}`, "PUT", { remainingBalance: 1, note: "x" }), ctx(loan._id));
    expect(res.status).toBe(200);
    expect((await res.json()).data.remainingBalance).toBe(toMinor(50000)); // ignored, unchanged
  });

  it("a loan deducted on a PAID payslip can no longer be edited (409), only its note", async () => {
    await setSession(adminOf(ORG_A));
    const { employee, period } = await seedPayroll();
    const loan = (await (await createLoan(req("/api/payroll/loans", "POST", {
      employeeId: employee._id, principal: toMinor(50000), installmentAmount: toMinor(10000),
    }))).json()).data;

    const run = (await (await createRun(req("/api/payroll/runs", "POST", { payPeriodId: period._id }))).json()).data.run;
    await submitRun(req(`/api/payroll/runs/${run._id}/submit`, "POST"), ctx(run._id));
    await approveRun(req(`/api/payroll/runs/${run._id}/approve`, "POST"), ctx(run._id));
    expect((await markPaidRun(req(`/api/payroll/runs/${run._id}/mark-paid`, "POST"), ctx(run._id))).status).toBe(200);

    // Editing a business field is now blocked…
    const blocked = await putLoan(req(`/api/payroll/loans/${loan._id}`, "PUT", { installmentAmount: toMinor(5000) }), ctx(loan._id));
    expect(blocked.status).toBe(409);
    // …but the note may still be updated.
    const noteOk = await putLoan(req(`/api/payroll/loans/${loan._id}`, "PUT", { note: "settled early" }), ctx(loan._id));
    expect(noteOk.status).toBe(200);
  });
});

// ─── R8 — platform mark_paid idempotency ─────────────────────────────────────────
describe("R8 — manual mark_paid is idempotent per click", () => {
  it("the same idempotencyKey records exactly one PaymentRecord", async () => {
    const u = await User.create({ name: "Owner", email: "idem@ex.com", role: "admin" });
    const org = await Organization.create({ name: "IdemOrg", owner_user_id: u._id });
    const orgId = String(org._id);
    await runWithOrg(orgId, async () => await Subscription.create({
      status: "active",
      plan_snapshot: { name: "P", slug: "p", billing_interval: "monthly", price_pkr: 0, price_usd: 0, currency: "PKR", features: ["invoices"] },
      current_period_start: new Date(), current_period_end: null, cancel_at_period_end: false,
    }));

    const { POST } = await import("@/app/api/platform/tenants/[id]/actions/route");
    const { auth } = await import("@/auth");
    (auth as any).mockResolvedValue({ user: { isPlatformAdmin: true, platformAdminId: "0000000000000000000000b1", email: "o@x.com" } });

    const body = { action: "mark_paid", amount: 5000, currency: "PKR", idempotencyKey: "click-123" };
    const r1 = await POST(req(`/api/platform/tenants/${orgId}/actions`, "POST", body), ctx(orgId) as any, undefined as any);
    const r2 = await POST(req(`/api/platform/tenants/${orgId}/actions`, "POST", body), ctx(orgId) as any, undefined as any);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const count = await runWithOrg(orgId, async () => await PaymentRecord.countDocuments({ idempotency_key: "click-123" }));
    expect(count).toBe(1); // double-submit recorded the payment once
  });
});

// ─── R9 — WhatsApp webhook fails closed without a secret ──────────────────────────
describe("R9 — unauthenticated WhatsApp webhook is dropped (fail-closed)", () => {
  it("does not process an inbound payload when WHATSAPP_WEBHOOK_SECRET is unset", async () => {
    const prev = process.env.WHATSAPP_WEBHOOK_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    try {
      const { POST } = await import("@/app/api/webhooks/whatsapp/route");
      const payload = {
        entry: [{ changes: [{ value: {
          metadata: { display_phone_number: "923001112222" },
          messages: [{ from: "923009998888", id: "wamid.TEST1", type: "text", text: { body: "hi" }, timestamp: "1700000000" }],
        } }] }],
      };
      const res = await POST(req("/api/webhooks/whatsapp", "POST", payload));
      expect(res.status).toBe(200); // always 200 to the provider…
      // …but nothing was stored (forged/unverifiable payload dropped).
      const stored = await runWithOrg("0000000000000000000000ce", async () =>
        await WhatsAppMessage.countDocuments({ messageId: "wamid.TEST1" }),
      );
      expect(stored).toBe(0);
    } finally {
      if (prev !== undefined) process.env.WHATSAPP_WEBHOOK_SECRET = prev;
    }
  });
});
