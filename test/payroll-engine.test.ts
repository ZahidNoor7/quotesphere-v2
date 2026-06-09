import { describe, it, expect } from "vitest";
import { calculatePayslip } from "@/lib/payroll/engine";
import { defaultPayrollConfig } from "@/lib/payroll/defaults";
import { toMinor } from "@/lib/payroll/money";
import type { PayrollEngineConfig, SalaryComponent } from "@/lib/payroll/types";

function engineConfig(overrides: Partial<PayrollEngineConfig> = {}): PayrollEngineConfig {
  const d = defaultPayrollConfig("PKR");
  return {
    taxEnabled: d.statutory.taxEnabled,
    taxSlabs: d.taxSlabs,
    eobi: d.eobi,
    providentFund: d.providentFund,
    configCurrency: "PKR",
    ...overrides,
  };
}

const PKR_FX = { base: "PKR", rates: {} as Record<string, number> };
const NO_EOBI = { enabled: false, employeeRate: 0, employerRate: 0, minWage: 0 };

describe("calculatePayslip", () => {
  it("basic salaried PKR case (basic + fixed allowance, EOBI on, tax on)", () => {
    const components: SalaryComponent[] = [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(100000), isBasic: true, taxable: true },
      { name: "House Rent", type: "earning", calculation: "fixed", value: toMinor(40000), taxable: true },
    ];
    const r = calculatePayslip({ payCurrency: "PKR", components, config: engineConfig(), loanInstallments: [], fx: PKR_FX });

    expect(r.gross).toBe(toMinor(140000));
    // EOBI employee = 1% of 37,000 = 370
    expect(r.deductions.find((d) => d.name === "EOBI")?.amount).toBe(toMinor(370));
    // annual taxable = 1,680,000 → 6,000 + 11% of 480,000 = 58,800 → monthly = round(58,800/12)
    expect(r.deductions.find((d) => d.name === "Income Tax")?.amount).toBe(Math.round(toMinor(58800) / 12));
    expect(r.net).toBe(r.gross - r.totalDeductions);
    expect(r.baseCurrencyNet).toBe(r.net); // base === payCurrency
  });

  it("applies a percentage_of_basic allowance", () => {
    const components: SalaryComponent[] = [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(100000), isBasic: true },
      { name: "Medical", type: "earning", calculation: "percentage_of_basic", value: 10 }, // 10% of basic = 10,000
    ];
    const r = calculatePayslip({ payCurrency: "PKR", components, config: engineConfig({ taxEnabled: false }), loanInstallments: [], fx: PKR_FX });
    expect(r.gross).toBe(toMinor(110000));
    expect(r.earnings.find((e) => e.name === "Medical")?.amount).toBe(toMinor(10000));
  });

  it("deducts a loan installment and clamps it so net stays >= 0", () => {
    const components: SalaryComponent[] = [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(50000), isBasic: true, taxable: false },
    ];
    const cfg = engineConfig({ taxEnabled: false, eobi: NO_EOBI });

    const within = calculatePayslip({ payCurrency: "PKR", components, config: cfg, loanInstallments: [{ loanId: "l1", name: "Loan", amount: toMinor(10000) }], fx: PKR_FX });
    expect(within.net).toBe(toMinor(40000));
    expect(within.appliedLoans[0]).toEqual({ loanId: "l1", applied: toMinor(10000) });

    const exceeding = calculatePayslip({ payCurrency: "PKR", components, config: cfg, loanInstallments: [{ loanId: "l1", name: "Loan", amount: toMinor(99999) }], fx: PKR_FX });
    expect(exceeding.net).toBe(0);
    expect(exceeding.appliedLoans[0].applied).toBe(toMinor(50000));
  });

  it("USD-paid employee converts to base (PKR) and back for tax", () => {
    const rates = { USD: 0.0036 }; // 1 PKR = 0.0036 USD → 1 USD ≈ 277.78 PKR
    const components: SalaryComponent[] = [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(1000), isBasic: true, taxable: true },
    ];
    const cfg = engineConfig({ eobi: NO_EOBI });
    const r = calculatePayslip({ payCurrency: "USD", components, config: cfg, loanInstallments: [], fx: { base: "PKR", rates } });

    expect(r.fxRate).toBe(0.0036);
    expect(r.baseCurrencyGross).toBe(Math.round(toMinor(1000) / 0.0036));
    expect(r.taxableIncomeAnnual).toBe(Math.round(toMinor(1000) / 0.0036) * 12);
  });

  it("throws when a foreign currency has no FX rate", () => {
    const components: SalaryComponent[] = [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(1000), isBasic: true },
    ];
    expect(() =>
      calculatePayslip({ payCurrency: "USD", components, config: engineConfig({ taxEnabled: false }), loanInstallments: [], fx: { base: "PKR", rates: {} } })
    ).toThrow(/No FX rate/);
  });

  it("splits provident fund into an employee deduction and an employer contribution", () => {
    const components: SalaryComponent[] = [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(100000), isBasic: true, taxable: false },
    ];
    const cfg = engineConfig({
      taxEnabled: false,
      eobi: NO_EOBI,
      providentFund: { enabled: true, employeeRate: 8, employerRate: 8 },
    });
    const r = calculatePayslip({ payCurrency: "PKR", components, config: cfg, loanInstallments: [], fx: PKR_FX });

    expect(r.deductions.find((d) => d.name === "Provident Fund")?.amount).toBe(toMinor(8000));
    expect(r.employerContributions.pf).toBe(toMinor(8000));
    expect(r.net).toBe(r.gross - r.totalDeductions); // employer PF is NOT in the employee's deductions
  });
});
