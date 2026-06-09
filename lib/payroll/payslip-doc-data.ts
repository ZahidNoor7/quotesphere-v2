import { formatMoney } from "./money";
import type { SalaryComponent, PayslipLine } from "./types";

// Maps a frozen Payslip (+ company branding + its period) into a flat view-model the
// print component renders. Pure — no DB. All money is formatted from minor units here.

interface PayslipInput {
  employeeSnapshot: {
    name: string; employee_code: string; designation?: string; department?: string;
    bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string;
  };
  componentsSnapshot: SalaryComponent[];
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  gross: number;
  totalDeductions: number;
  net: number;
  payCurrency: string;
}

interface SettingsInput {
  company_name?: string;
  company_logo?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
}

interface PeriodInput {
  label?: string;
  payDate?: string | Date;
}

export interface PayslipViewModel {
  company: { name: string; logo?: string; address?: string; phone?: string; email?: string };
  period: { label: string; payDate?: string };
  employee: { name: string; code: string; designation?: string; department?: string; bank?: string; account?: string; iban?: string };
  earnings: Array<{ name: string; amount: string }>;
  deductions: Array<{ name: string; amount: string }>;
  gross: string;
  totalDeductions: string;
  net: string;
  currency: string;
}

function fmtDate(d?: string | Date): string | undefined {
  if (!d) return undefined;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function buildPayslipData(slip: PayslipInput, settings: SettingsInput | null, period: PeriodInput | null): PayslipViewModel {
  const ccy = slip.payCurrency;
  const e = slip.employeeSnapshot;
  return {
    company: {
      name: settings?.company_name || "Company",
      logo: settings?.company_logo,
      address: settings?.company_address,
      phone: settings?.company_phone,
      email: settings?.company_email,
    },
    period: { label: period?.label || "Pay period", payDate: fmtDate(period?.payDate) },
    employee: {
      name: e.name,
      code: e.employee_code,
      designation: e.designation,
      department: e.department,
      bank: e.bankName,
      account: e.accountNumber || e.accountTitle,
      iban: e.iban,
    },
    earnings: slip.earnings.map((l) => ({ name: l.name, amount: formatMoney(l.amount, ccy) })),
    deductions: slip.deductions.map((l) => ({ name: l.name, amount: formatMoney(l.amount, ccy) })),
    gross: formatMoney(slip.gross, ccy),
    totalDeductions: formatMoney(slip.totalDeductions, ccy),
    net: formatMoney(slip.net, ccy),
    currency: ccy,
  };
}
