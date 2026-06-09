"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AC2, T2, GLASS_BORDER } from "@/lib/ds";

const TABS = [
  { href: "/payroll/runs", label: "Payroll runs" },
  { href: "/payroll/employees", label: "Employees" },
  { href: "/payroll/salary-structures", label: "Salary structures" },
  { href: "/payroll/pay-periods", label: "Pay periods" },
  { href: "/payroll/loans", label: "Loans & advances" },
  { href: "/payroll/reports", label: "Reports" },
  { href: "/payroll/config", label: "Tax & config" },
];

export function PayrollTabs() {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", gap: 2, overflowX: "auto" }} className="scrollbar-hide">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              fontSize: 12.5,
              padding: "6px 12px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
              ...(active
                ? { background: "color-mix(in srgb,var(--accent) 18%,transparent)", color: AC2, fontWeight: 500, border: `0.5px solid color-mix(in srgb,var(--accent) 25%,transparent)` }
                : { color: T2, border: `0.5px solid transparent` }),
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export { GLASS_BORDER };
