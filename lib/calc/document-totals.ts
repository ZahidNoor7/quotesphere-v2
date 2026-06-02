// Canonical document totals math — the single source of truth for line-item
// subtotal / tax / total, shared by the AI assistant tool executor and available
// to the DocumentBuilder form. Mirrors the formula in
// components/forms/document-builder.tsx and app/api/quotations/[id]/convert/route.ts.

export interface TotalsLineItem {
  quantity: number;
  price: number;
}

export interface ComputeTotalsInput {
  items: TotalsLineItem[];
  tax?: number;
  tax_type?: "percentage" | "value";
  discount?: number;
  delivery_charges?: number;
  /** Invoices only — advance/prepaid amount, used to derive outstanding. */
  advance?: number;
}

export interface DocumentTotals {
  sub_total: number;
  tax_amount: number;
  total_amount: number;
  /** Invoices only — max(0, total_amount - advance). */
  outstanding: number;
}

/**
 * Compute sub_total, tax, total_amount (and outstanding for invoices) from line
 * items. Identical to the math used by the manual DocumentBuilder form so a
 * quotation/invoice created via chat matches one created in the UI exactly.
 */
export function computeDocumentTotals(input: ComputeTotalsInput): DocumentTotals {
  const {
    items,
    tax = 0,
    tax_type = "percentage",
    discount = 0,
    delivery_charges = 0,
    advance = 0,
  } = input;

  const sub_total = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
    0
  );
  const tax_amount = tax_type === "percentage" ? (sub_total * tax) / 100 : tax;
  const total_amount = sub_total + tax_amount + delivery_charges - discount;
  const outstanding = Math.max(0, total_amount - advance);

  return { sub_total, tax_amount, total_amount, outstanding };
}
