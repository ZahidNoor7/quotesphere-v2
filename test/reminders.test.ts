import { describe, it, expect, vi, beforeEach } from "vitest";

// The cron route imports these — mock them so no real email/WhatsApp is sent.
vi.mock("@/lib/email", () => ({ sendPaymentReminderEmail: vi.fn().mockResolvedValue({ id: "e1" }) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ messageId: "m1" }),
  normalizePhone: (p: string) => p,
}));

import mongoose from "mongoose";
import { GET } from "@/app/api/cron/reminders/route";
import * as email from "@/lib/email";
import * as wa from "@/lib/whatsapp";
import Customer from "@/models/Customer";
import Invoice from "@/models/Invoice";
import Settings from "@/models/Settings";
import { req } from "./helpers";

function atMidnight(offsetDays: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const seedSettings = (reminders: any, integrations?: any) =>
  Settings.create({ user_id: new mongoose.Types.ObjectId(), company_name: "Test Co", reminders, ...(integrations ? { integrations } : {}) });

const seedInvoice = (customer: any, dueOffsetDays: number, total = 1000) =>
  Invoice.create({
    issue_date: new Date(),
    due_date: atMidnight(dueOffsetDays),
    status: "issued",
    items: [{ id: 1, name: "Item", quantity: 1, price: total }],
    sub_total: total, total_amount: total,
    customer_id: customer._id, customer_name: customer.name, customer_phone: customer.phone_no,
  });

describe("payment reminders cron", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("emails due-soon + overdue invoices, then is idempotent the same day", async () => {
    await seedSettings({ enabled: true, channels: { email: true, whatsapp: false }, dueSoonDays: 3, overdueDays: [1, 7, 14] });
    const customer = await Customer.create({ name: "Acme", phone_no: "923001", email: "c@test.com" });
    const overdue = await seedInvoice(customer, -7); // overdue by 7 → matches
    const dueSoon = await seedInvoice(customer, 3);  // due in 3 → matches
    await seedInvoice(customer, 30);                 // far future → skipped

    const json = await (await GET(req("/api/cron/reminders"))).json();
    expect(json.success).toBe(true);
    expect(json.sent).toBe(2);
    expect(email.sendPaymentReminderEmail).toHaveBeenCalledTimes(2);

    const o = (await Invoice.findById(overdue._id).lean()) as any;
    const d = (await Invoice.findById(dueSoon._id).lean()) as any;
    expect(o.lastReminderAt).toBeTruthy();
    expect(d.lastReminderAt).toBeTruthy();

    // Re-run the same day → nothing new (lastReminderAt guard).
    const json2 = await (await GET(req("/api/cron/reminders"))).json();
    expect(json2.sent).toBe(0);
  });

  it("skips everything when reminders are disabled", async () => {
    await seedSettings({ enabled: false, channels: { email: true, whatsapp: false }, dueSoonDays: 3, overdueDays: [7] });
    await seedInvoice(await Customer.create({ name: "X", phone_no: "1", email: "x@t.com" }), -7);
    const json = await (await GET(req("/api/cron/reminders"))).json();
    expect(json.sent).toBe(0);
    expect(email.sendPaymentReminderEmail).not.toHaveBeenCalled();
  });

  it("uses only the enabled channel (WhatsApp only, no email)", async () => {
    await seedSettings(
      { enabled: true, channels: { email: false, whatsapp: true }, dueSoonDays: 3, overdueDays: [7] },
      { whatsapp: { enabled: true, mode: "production", apiKey: "k", phoneNumber: "92300" } },
    );
    const customer = await Customer.create({ name: "Acme", phone_no: "923001", email: "c@test.com" });
    await seedInvoice(customer, -7);
    const json = await (await GET(req("/api/cron/reminders"))).json();
    expect(json.sent).toBe(1);
    expect(email.sendPaymentReminderEmail).not.toHaveBeenCalled();
    expect(wa.sendWhatsAppMessage).toHaveBeenCalledTimes(1);
  });
});
