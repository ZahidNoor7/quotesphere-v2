// Minor-unit money helpers for payroll. Payroll stores ALL money as INTEGER minor
// units (amount × 100) so tax/payroll arithmetic is exact and reproducible —
// deliberately different from the rest of the app (which uses float major units).
// All 6 supported currencies (PKR/USD/EUR/GBP/AED/SAR) have ISO 4217 minor-unit
// exponent 2, so a single scale of 100 is correct for every one of them.
//
// Precision note: rounding is applied only where a division can introduce a
// fraction (FX conversion, percentages). Integer sums never drift, so cross-currency
// run roll-ups stay exact.

export const MONEY_SCALE = 100;

/** Major units (e.g. rupees) → integer minor units (e.g. paisa). */
export function toMinor(major: number): number {
  return Math.round((Number(major) || 0) * MONEY_SCALE);
}

/** Integer minor units → major units, for display/formatting only. */
export function fromMinor(minor: number): number {
  return (Number(minor) || 0) / MONEY_SCALE;
}

/** `percent` of a minor-unit base, rounded to whole minor units. */
export function pct(baseMinor: number, percent: number): number {
  return Math.round((baseMinor * percent) / 100);
}

/**
 * Convert a minor-unit amount in `ccy` to the tenant base currency.
 * rates[ccy] = units of ccy per 1 base, so base = amount / rate.
 */
export function toBaseMinor(minor: number, ccy: string, base: string, rates: Record<string, number>): number {
  if (ccy === base) return Math.round(minor);
  const r = rates?.[ccy];
  if (!r || r <= 0) throw new Error(`No FX rate for ${ccy} relative to base ${base}`);
  return Math.round(minor / r);
}

/** Convert a minor-unit base amount into `ccy` (base × rate). */
export function fromBaseMinor(baseMinor: number, ccy: string, base: string, rates: Record<string, number>): number {
  if (ccy === base) return Math.round(baseMinor);
  const r = rates?.[ccy];
  if (!r || r <= 0) throw new Error(`No FX rate for ${ccy} relative to base ${base}`);
  return Math.round(baseMinor * r);
}

/** Format a minor-unit amount for display, e.g. formatMoney(150000, "PKR") → "PKR 1,500.00". */
export function formatMoney(minor: number, currency: string): string {
  const major = fromMinor(minor);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
