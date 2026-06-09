import type { TaxSlab } from "./types";

/**
 * Progressive marginal income tax for ANY slab table, in minor units. Slabs use the
 * FBR "fixed + marginal" form: for the bracket containing `annual`,
 *   tax = fixedAmount + (annual − minAnnual) × ratePercent / 100.
 * `fixedAmount` already encodes the accumulated tax of every lower bracket, so
 * swapping in a new FBR table just works. The top slab has `maxAnnual = null`.
 *
 * Pure and unit-testable — no DB, no config lookups. Slabs are read from the
 * per-tenant PayrollConfig by the caller and passed in.
 */
export function computeAnnualIncomeTaxMinor(annualMinor: number, slabs: TaxSlab[]): number {
  if (annualMinor <= 0 || !slabs?.length) return 0;
  const sorted = [...slabs].sort((a, b) => a.minAnnual - b.minAnnual);
  let chosen = sorted[0];
  for (const s of sorted) {
    if (annualMinor >= s.minAnnual && (s.maxAnnual === null || annualMinor < s.maxAnnual)) {
      chosen = s;
      break;
    }
    if (annualMinor >= s.minAnnual) chosen = s; // carry forward toward the open top slab
  }
  const taxable = Math.max(0, annualMinor - chosen.minAnnual);
  return Math.round(chosen.fixedAmount + (taxable * chosen.ratePercent) / 100);
}

/** Monthly tax = annual tax / 12, rounded to minor units. */
export function computeMonthlyIncomeTaxMinor(annualMinor: number, slabs: TaxSlab[]): number {
  return Math.round(computeAnnualIncomeTaxMinor(annualMinor, slabs) / 12);
}
