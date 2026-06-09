// Pure domain types for the payroll engine. No Mongoose/DB imports — these are the
// computation contracts shared by the models, the engine and the API layer.
//
// MONEY CONVENTION: every monetary field here is an INTEGER in minor units
// (amount × 100), e.g. Rs 1,500.00 → 150000. Percent fields (ratePercent,
// employeeRate, a percentage_of_basic component's value, …) are plain numbers.
// This minor-unit convention is deliberately isolated to the payroll module; the
// rest of the app uses float major units. Convert at the UI/display edge only.

export type ComponentType = "earning" | "deduction";
export type ComponentCalc = "fixed" | "percentage_of_basic";

export interface SalaryComponent {
  name: string;
  type: ComponentType;
  calculation: ComponentCalc;
  /** `fixed` → amount in minor units. `percentage_of_basic` → a percent (0–100). */
  value: number;
  /** Exactly one component per structure is the basic (must be a fixed earning). */
  isBasic?: boolean;
  /** Earnings default taxable; deductions are never taxed. */
  taxable?: boolean;
}

export interface TaxSlab {
  minAnnual: number;            // minor units, inclusive lower bound
  maxAnnual: number | null;     // minor units, exclusive upper bound; null = open top
  fixedAmount: number;          // minor units — tax accumulated up to minAnnual
  ratePercent: number;          // marginal rate on (annual − minAnnual)
}

export interface EobiConfig {
  enabled: boolean;
  employeeRate: number;   // percent of minWage
  employerRate: number;   // percent of minWage
  minWage: number;        // minor units
}

export interface ProvidentFundConfig {
  enabled: boolean;
  employeeRate: number;   // percent of basic
  employerRate: number;   // percent of basic
}

export interface PayrollEngineConfig {
  taxEnabled: boolean;
  taxSlabs: TaxSlab[];
  eobi: EobiConfig;
  providentFund: ProvidentFundConfig;
  /** Currency the slabs / minWage are denominated in (the tenant base currency). */
  configCurrency: string;
}

export interface FxSnapshot {
  base: string;
  /** rates[X] = units of X per 1 base (exchangerate-api `latest/{base}` convention). */
  rates: Record<string, number>;
}

export interface LoanInstallmentInput {
  loanId: string;
  name: string;
  amount: number;   // minor units, in the employee's payCurrency (requested installment)
}

export interface PayslipLine {
  name: string;
  amount: number;   // minor units, employee payCurrency
}

export interface CalculatePayslipInput {
  payCurrency: string;
  components: SalaryComponent[];
  config: PayrollEngineConfig;
  loanInstallments: LoanInstallmentInput[];
  fx: FxSnapshot;
}

export interface CalculatePayslipResult {
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  gross: number;                  // payCurrency minor units
  totalDeductions: number;        // payCurrency minor units
  net: number;                    // payCurrency minor units
  payCurrency: string;
  fxRate: number;                 // foreign-per-base for payCurrency (1 if base)
  baseCurrency: string;
  baseCurrencyGross: number;      // base minor units
  baseCurrencyNet: number;        // base minor units
  taxableIncomeAnnual: number;    // base minor units (what tax was computed on)
  employerContributions: { eobi: number; pf: number }; // base minor units
  appliedLoans: Array<{ loanId: string; applied: number }>; // minor units, payCurrency
}
