import { toMinor } from "./money";
import type { TaxSlab } from "./types";

/**
 * FBR 2025-26 salaried annual income-tax slabs (declared in PKR major units; stored
 * in minor units). These are SEEDED into each org's PayrollConfig and are fully
 * editable afterwards — tax rates are never hardcoded in the engine, they live in
 * the per-tenant config so an admin can update them when FBR changes the table.
 */
const FBR_2025_26_SALARIED: Array<{ minAnnual: number; maxAnnual: number | null; fixedAmount: number; ratePercent: number }> = [
  { minAnnual: 0,        maxAnnual: 600000,  fixedAmount: 0,      ratePercent: 0 },
  { minAnnual: 600000,   maxAnnual: 1200000, fixedAmount: 0,      ratePercent: 1 },
  { minAnnual: 1200000,  maxAnnual: 2200000, fixedAmount: 6000,   ratePercent: 11 },
  { minAnnual: 2200000,  maxAnnual: 3200000, fixedAmount: 116000, ratePercent: 23 },
  { minAnnual: 3200000,  maxAnnual: 4100000, fixedAmount: 346000, ratePercent: 30 },
  { minAnnual: 4100000,  maxAnnual: null,    fixedAmount: 616000, ratePercent: 35 },
];

export interface DefaultPayrollConfig {
  taxYearLabel: string;
  currency: string;
  taxSlabs: TaxSlab[];
  eobi: { enabled: boolean; employeeRate: number; employerRate: number; minWage: number };
  providentFund: { enabled: boolean; employeeRate: number; employerRate: number };
  statutory: { taxEnabled: boolean };
}

/**
 * Build the editable default PayrollConfig for a new org. Money fields are stored in
 * minor units. Lazy-created on first access to the config route, mirroring how
 * Settings is created on first GET.
 */
export function defaultPayrollConfig(baseCurrency = "PKR"): DefaultPayrollConfig {
  return {
    taxYearLabel: "2025-26",
    currency: baseCurrency,
    taxSlabs: FBR_2025_26_SALARIED.map((s) => ({
      minAnnual: toMinor(s.minAnnual),
      maxAnnual: s.maxAnnual === null ? null : toMinor(s.maxAnnual),
      fixedAmount: toMinor(s.fixedAmount),
      ratePercent: s.ratePercent,
    })),
    // EOBI 2025: employee 1% + employer 5% of the Rs 37,000 minimum wage.
    eobi: { enabled: true, employeeRate: 1, employerRate: 5, minWage: toMinor(37000) },
    // Provident fund is employer policy — off by default, rates editable per tenant.
    providentFund: { enabled: false, employeeRate: 0, employerRate: 0 },
    statutory: { taxEnabled: true },
  };
}
