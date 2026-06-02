import { describe, it, expect, vi } from "vitest";

// Mock the LLM vision call so no real provider is hit.
vi.mock("@/lib/assistant/vision", () => ({
  extractBillFromImage: vi.fn().mockResolvedValue({
    vendor_name: "Fuel Co", bill_date: "2026-06-01", currency: "PKR", tax: 0,
    items: [{ name: "Diesel", quantity: 10, unit_price: 300 }, { name: "Oil", quantity: 2, unit_price: 500 }],
  }),
}));

import { POST } from "@/app/api/expenses/scan/route";
import * as vision from "@/lib/assistant/vision";
import Expense from "@/models/Expense";
import { req, setSession } from "./helpers";

describe("expense scan (AI vision)", () => {
  it("returns a structured draft with computed totals and persists nothing", async () => {
    const res = await POST(req("/api/expenses/scan", "POST", { imageUrl: "https://res.cloudinary.com/x/bill.jpg" }));
    expect(res.status).toBe(200);
    const d = (await res.json()).data;
    expect(d.vendor_name).toBe("Fuel Co");
    expect(d.currency).toBe("PKR");
    expect(d.items).toHaveLength(2);
    expect(d.items[0].total).toBe(3000); // 10 × 300
    expect(d.items[1].total).toBe(1000); // 2 × 500
    expect(await Expense.countDocuments()).toBe(0); // never saved
    expect(vision.extractBillFromImage).toHaveBeenCalledOnce();
  });

  it("rejects an invalid imageUrl (400)", async () => {
    const res = await POST(req("/api/expenses/scan", "POST", { imageUrl: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("401 without a session", async () => {
    await setSession(null);
    const res = await POST(req("/api/expenses/scan", "POST", { imageUrl: "https://x.com/a.jpg" }));
    expect(res.status).toBe(401);
  });

  it("403 for a viewer (no create permission)", async () => {
    await setSession({ user: { id: "v", role: "viewer" } });
    const res = await POST(req("/api/expenses/scan", "POST", { imageUrl: "https://x.com/a.jpg" }));
    expect(res.status).toBe(403);
  });
});
