import { calculatePayslip } from "./engine";
import type { PayrollEngineConfig, SalaryComponent, PayslipLine } from "./types";

// Pure run-generation: turns loaded employees + structures + loans + config + FX into
// the payslip docs and base-currency totals to persist. No DB/IO here — the route
// loads the data and writes the result in a transaction. Mirrors how the engine and
// document-totals stay side-effect-free and unit-testable.

export interface RunEmployee {
  _id: string;
  employee_code?: string;
  name: string;
  designation?: string;
  department?: string;
  payCurrency: string;
  salaryStructureId?: string | null;
  bankDetails?: { bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string };
}

export interface RunStructure {
  _id: string;
  components: SalaryComponent[];
}

export interface RunLoan {
  _id: string;
  type: "loan" | "advance";
  installmentAmount: number;
  remainingBalance: number;
}

export interface BuiltPayslip {
  employeeId: string;
  employeeSnapshot: {
    employeeId: string;
    employee_code: string;
    name: string;
    designation?: string;
    department?: string;
    payCurrency: string;
    bankName?: string;
    accountTitle?: string;
    accountNumber?: string;
    iban?: string;
  };
  componentsSnapshot: SalaryComponent[];
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  gross: number;
  totalDeductions: number;
  net: number;
  appliedLoans: Array<{ loanId: string; amount: number }>;
  payCurrency: string;
  fxRate: number;
  baseCurrency: string;
  baseCurrencyGross: number;
  baseCurrencyNet: number;
  taxableIncomeAnnual: number;
}

export interface RunTotals {
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
  employerCostTotal: number;
  employeeCount: number;
}

export interface BuildRunResult {
  payslips: BuiltPayslip[];
  totals: RunTotals;
  skipped: Array<{ employee_code: string; name: string; reason: string }>;
}

export function buildRunPayslips(input: {
  employees: RunEmployee[];
  structuresById: Map<string, RunStructure>;
  loansByEmployee: Map<string, RunLoan[]>;
  config: PayrollEngineConfig;
  fx: { base: string; rates: Record<string, number> };
}): BuildRunResult {
  const { employees, structuresById, loansByEmployee, config, fx } = input;
  const payslips: BuiltPayslip[] = [];
  const skipped: BuildRunResult["skipped"] = [];
  const totals: RunTotals = { grossTotal: 0, deductionsTotal: 0, netTotal: 0, employerCostTotal: 0, employeeCount: 0 };

  for (const emp of employees) {
    const structure = emp.salaryStructureId ? structuresById.get(String(emp.salaryStructureId)) : undefined;
    if (!structure || structure.components.length === 0) {
      skipped.push({ employee_code: emp.employee_code ?? "", name: emp.name, reason: "No salary structure assigned" });
      continue;
    }
    const loans = loansByEmployee.get(String(emp._id)) ?? [];
    const loanInstallments = loans.map((l) => ({
      loanId: String(l._id),
      name: l.type === "advance" ? "Advance" : "Loan",
      amount: Math.min(l.installmentAmount, l.remainingBalance),
    }));

    const r = calculatePayslip({
      payCurrency: emp.payCurrency,
      components: structure.components,
      config,
      loanInstallments,
      fx,
    });

    payslips.push({
      employeeId: String(emp._id),
      employeeSnapshot: {
        employeeId: String(emp._id),
        employee_code: emp.employee_code ?? "",
        name: emp.name,
        designation: emp.designation,
        department: emp.department,
        payCurrency: emp.payCurrency,
        bankName: emp.bankDetails?.bankName,
        accountTitle: emp.bankDetails?.accountTitle,
        accountNumber: emp.bankDetails?.accountNumber,
        iban: emp.bankDetails?.iban,
      },
      componentsSnapshot: structure.components,
      earnings: r.earnings,
      deductions: r.deductions,
      gross: r.gross,
      totalDeductions: r.totalDeductions,
      net: r.net,
      appliedLoans: r.appliedLoans.filter((a) => a.applied > 0).map((a) => ({ loanId: a.loanId, amount: a.applied })),
      payCurrency: r.payCurrency,
      fxRate: r.fxRate,
      baseCurrency: r.baseCurrency,
      baseCurrencyGross: r.baseCurrencyGross,
      baseCurrencyNet: r.baseCurrencyNet,
      taxableIncomeAnnual: r.taxableIncomeAnnual,
    });

    totals.grossTotal += r.baseCurrencyGross;
    totals.deductionsTotal += r.baseCurrencyGross - r.baseCurrencyNet;
    totals.netTotal += r.baseCurrencyNet;
    totals.employerCostTotal += r.baseCurrencyGross + r.employerContributions.eobi + r.employerContributions.pf;
    totals.employeeCount += 1;
  }

  return { payslips, totals, skipped };
}
