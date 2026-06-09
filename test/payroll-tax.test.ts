import { describe, it, expect } from "vitest";
import { computeAnnualIncomeTaxMinor, computeMonthlyIncomeTaxMinor } from "@/lib/payroll/tax";
import { defaultPayrollConfig } from "@/lib/payroll/defaults";
import { toMinor } from "@/lib/payroll/money";

const slabs = defaultPayrollConfig("PKR").taxSlabs;

describe("progressive income tax (FBR 2025-26 default slabs)", () => {
  it("is zero up to the first threshold", () => {
    expect(computeAnnualIncomeTaxMinor(0, slabs)).toBe(0);
    expect(computeAnnualIncomeTaxMinor(toMinor(600000), slabs)).toBe(0);
  });

  it("applies 1% in the second slab", () => {
    // 900,000 → 1% of (900,000 − 600,000) = 3,000
    expect(computeAnnualIncomeTaxMinor(toMinor(900000), slabs)).toBe(toMinor(3000));
    // 1,200,000 boundary → fixed 6,000 of slab 3, taxable 0
    expect(computeAnnualIncomeTaxMinor(toMinor(1200000), slabs)).toBe(toMinor(6000));
  });

  it("uses fixed + marginal in the middle slabs", () => {
    // 2,200,000 → fixed 116,000 of slab 4, taxable 0
    expect(computeAnnualIncomeTaxMinor(toMinor(2200000), slabs)).toBe(toMinor(116000));
    // 3,200,000 → fixed 346,000 of slab 5, taxable 0
    expect(computeAnnualIncomeTaxMinor(toMinor(3200000), slabs)).toBe(toMinor(346000));
  });

  it("uses the open-ended top slab", () => {
    // 5,000,000 → fixed 616,000 + 35% of 900,000 = 931,000
    expect(computeAnnualIncomeTaxMinor(toMinor(5000000), slabs)).toBe(toMinor(931000));
  });

  it("monthly tax is annual / 12", () => {
    const annual = computeAnnualIncomeTaxMinor(toMinor(2400000), slabs);
    expect(computeMonthlyIncomeTaxMinor(toMinor(2400000), slabs)).toBe(Math.round(annual / 12));
  });

  it("works for any custom slab table", () => {
    const custom = [
      { minAnnual: 0, maxAnnual: toMinor(100000), fixedAmount: 0, ratePercent: 0 },
      { minAnnual: toMinor(100000), maxAnnual: null, fixedAmount: 0, ratePercent: 10 },
    ];
    // 200,000 → 10% of (200,000 − 100,000) = 10,000
    expect(computeAnnualIncomeTaxMinor(toMinor(200000), custom)).toBe(toMinor(10000));
  });
});
