import type { PayslipViewModel } from "@/lib/payroll/payslip-doc-data";

/**
 * Self-contained, print-friendly payslip. Rendered only by the token-gated
 * /print/payslip route and converted to PDF by headless Chrome. Light theme with
 * inline styles (print.css neutralizes the app's dark body).
 */
export function PayslipPrint({ data }: { data: PayslipViewModel }) {
  const { company, period, employee, earnings, deductions } = data;
  const cell: React.CSSProperties = { padding: "7px 10px", fontSize: 12 };
  const muted = "#6b7280";

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#111827", background: "#fff", padding: 40, maxWidth: 780, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111827", paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt="" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          ) : null}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{company.name}</div>
            {company.address && <div style={{ fontSize: 11, color: muted, maxWidth: 260 }}>{company.address}</div>}
            <div style={{ fontSize: 11, color: muted }}>{[company.phone, company.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.04em" }}>PAYSLIP</div>
          <div style={{ fontSize: 12, color: muted }}>{period.label}</div>
          {period.payDate && <div style={{ fontSize: 11, color: muted }}>Pay date: {period.payDate}</div>}
        </div>
      </div>

      {/* Employee */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20, fontSize: 12 }}>
        <Info label="Employee" value={employee.name} />
        <Info label="Employee code" value={employee.code} />
        {employee.designation && <Info label="Designation" value={employee.designation} />}
        {employee.department && <Info label="Department" value={employee.department} />}
        {employee.bank && <Info label="Bank" value={employee.bank} />}
        {employee.account && <Info label="Account" value={employee.account} />}
        {employee.iban && <Info label="IBAN" value={employee.iban} />}
      </div>

      {/* Earnings + deductions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <Section title="Earnings" lines={earnings} total={data.gross} totalLabel="Gross" cell={cell} />
        <Section title="Deductions" lines={deductions} total={data.totalDeductions} totalLabel="Total deductions" cell={cell} />
      </div>

      {/* Net pay */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 280, background: "#111827", color: "#fff", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Net pay ({data.currency})</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{data.net}</span>
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 10, color: muted, textAlign: "center" }}>
        This is a system-generated payslip and does not require a signature.
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Section({ title, lines, total, totalLabel, cell }: { title: string; lines: Array<{ name: string; amount: string }>; total: string; totalLabel: string; cell: React.CSSProperties }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ background: "#f9fafb", padding: "8px 10px", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {lines.length === 0 ? (
            <tr><td style={{ ...cell, color: "#9ca3af" }}>—</td></tr>
          ) : lines.map((l, i) => (
            <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <td style={cell}>{l.name}</td>
              <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.amount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <td style={{ ...cell, fontWeight: 700 }}>{totalLabel}</td>
            <td style={{ ...cell, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
