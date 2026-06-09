import { pct, toBaseMinor, fromBaseMinor } from "./money";
import { computeMonthlyIncomeTaxMinor } from "./tax";
import type {
  CalculatePayslipInput,
  CalculatePayslipResult,
  PayslipLine,
  SalaryComponent,
} from "./types";

/**
 * Pure payroll calculation. No DB/IO — every input is a frozen snapshot supplied by
 * the caller, so it is fully unit-testable (the convention established by
 * lib/calc/document-totals.ts). All money is integer minor units in the employee's
 * payCurrency, except the base-currency figures the caller uses for cross-currency
 * run roll-ups. See lib/payroll/types.ts for the contract.
 *
 * Order: earnings → income tax (computed in base on annualized taxable pay) → EOBI
 * (on statutory min wage) → provident fund (on basic) → structure deductions →
 * loans (clamped so net never goes negative).
 */
export function calculatePayslip(input: CalculatePayslipInput): CalculatePayslipResult {
  const { payCurrency, components, config, loanInstallments, fx } = input;
  const { base, rates } = fx;

  // 1. Resolve basic (must be a fixed earning; enforced by the schema validator).
  const basic = components.find((c) => c.isBasic);
  const basicMinor = basic?.value ?? 0;
  if (components.some((c) => c.calculation === "percentage_of_basic") && !basic) {
    throw new Error("Salary structure has percentage_of_basic components but no basic component");
  }

  const amountFor = (c: SalaryComponent): number =>
    c.calculation === "fixed" ? c.value : pct(basicMinor, c.value);

  // 2. Earnings → gross.
  const earnings: PayslipLine[] = components
    .filter((c) => c.type === "earning")
    .map((c) => ({ name: c.name, amount: amountFor(c) }));
  const gross = earnings.reduce((s, e) => s + e.amount, 0);

  const deductions: PayslipLine[] = [];

  // 3. Income tax — annualized taxable earnings, computed in base currency.
  const taxableMonthlyPay = components
    .filter((c) => c.type === "earning" && c.taxable !== false)
    .reduce((s, c) => s + amountFor(c), 0);
  const taxableMonthlyBase = toBaseMinor(taxableMonthlyPay, payCurrency, base, rates);
  const taxableIncomeAnnual = taxableMonthlyBase * 12;
  if (config.taxEnabled) {
    const monthlyTaxBase = computeMonthlyIncomeTaxMinor(taxableIncomeAnnual, config.taxSlabs);
    if (monthlyTaxBase > 0) {
      const taxPay = payCurrency === base ? monthlyTaxBase : fromBaseMinor(monthlyTaxBase, payCurrency, base, rates);
      deductions.push({ name: "Income Tax", amount: taxPay });
    }
  }

  // 4. EOBI — on the statutory minimum wage (base currency).
  const employerContributions = { eobi: 0, pf: 0 };
  if (config.eobi?.enabled) {
    const eobiEmpBase = pct(config.eobi.minWage, config.eobi.employeeRate);
    const eobiEmpPay = payCurrency === base ? eobiEmpBase : fromBaseMinor(eobiEmpBase, payCurrency, base, rates);
    if (eobiEmpPay > 0) deductions.push({ name: "EOBI", amount: eobiEmpPay });
    employerContributions.eobi = pct(config.eobi.minWage, config.eobi.employerRate);
  }

  // 5. Provident fund — percent of basic (payCurrency).
  if (config.providentFund?.enabled) {
    const pfEmpPay = pct(basicMinor, config.providentFund.employeeRate);
    if (pfEmpPay > 0) deductions.push({ name: "Provident Fund", amount: pfEmpPay });
    const pfEmployerPay = pct(basicMinor, config.providentFund.employerRate);
    employerContributions.pf = toBaseMinor(pfEmployerPay, payCurrency, base, rates);
  }

  // 6. Structure deduction components.
  for (const c of components.filter((c) => c.type === "deduction")) {
    deductions.push({ name: c.name, amount: amountFor(c) });
  }

  // 7. Loans — applied last and clamped so net never goes negative.
  let available = Math.max(0, gross - deductions.reduce((s, d) => s + d.amount, 0));
  const appliedLoans: Array<{ loanId: string; applied: number }> = [];
  for (const loan of loanInstallments) {
    const applied = Math.max(0, Math.min(loan.amount, available));
    if (applied > 0) {
      deductions.push({ name: loan.name, amount: applied });
      available -= applied;
    }
    appliedLoans.push({ loanId: loan.loanId, applied });
  }

  // 8. Totals + FX figures.
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const net = Math.max(0, gross - totalDeductions);
  const fxRate = payCurrency === base ? 1 : (rates?.[payCurrency] ?? 0);

  return {
    earnings,
    deductions,
    gross,
    totalDeductions,
    net,
    payCurrency,
    fxRate,
    baseCurrency: base,
    baseCurrencyGross: toBaseMinor(gross, payCurrency, base, rates),
    baseCurrencyNet: toBaseMinor(net, payCurrency, base, rates),
    taxableIncomeAnnual,
    employerContributions,
    appliedLoans,
  };
}
