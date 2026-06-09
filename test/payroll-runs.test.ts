import { describe, it, expect } from "vitest";
import { POST as createStructure } from "@/app/api/payroll/salary-structures/route";
import { POST as createEmployee, GET as listEmployees } from "@/app/api/payroll/employees/route";
import { POST as createPeriod } from "@/app/api/payroll/pay-periods/route";
import { GET as getPeriod } from "@/app/api/payroll/pay-periods/[id]/route";
import { POST as createRun } from "@/app/api/payroll/runs/route";
import { POST as submitRun } from "@/app/api/payroll/runs/[id]/submit/route";
import { POST as approveRun } from "@/app/api/payroll/runs/[id]/approve/route";
import { POST as markPaid } from "@/app/api/payroll/runs/[id]/mark-paid/route";
import { GET as runPayslips } from "@/app/api/payroll/runs/[id]/payslips/route";
import { req, ctx, setSession } from "./helpers";
import { toMinor } from "@/lib/payroll/money";

async function seed() {
  const structure = (await (await createStructure(req("/api/payroll/salary-structures", "POST", {
    name: "Standard",
    components: [
      { name: "Basic", type: "earning", calculation: "fixed", value: toMinor(100000), isBasic: true, taxable: true },
      { name: "House Rent", type: "earning", calculation: "fixed", value: toMinor(40000), taxable: true },
    ],
  }))).json()).data;

  const employee = (await (await createEmployee(req("/api/payroll/employees", "POST", {
    name: "Jane Doe", joinDate: "2025-01-01", payCurrency: "PKR", salaryStructureId: structure._id,
  }))).json()).data;

  const period = (await (await createPeriod(req("/api/payroll/pay-periods", "POST", {
    label: "June 2026", startDate: "2026-06-01", endDate: "2026-06-30", payDate: "2026-07-01",
  }))).json()).data;

  return { structure, employee, period };
}

describe("payroll runs: workflow, idempotency, tenant isolation", () => {
  it("generates a draft run with one payslip and is idempotent per period", async () => {
    const { period } = await seed();

    const r1 = await createRun(req("/api/payroll/runs", "POST", { payPeriodId: period._id }));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    expect(j1.data.run.run_no).toMatch(/^PR-\d{5}$/);
    expect(j1.data.payslipCount).toBe(1);

    // A second run for the same period is rejected — the partial-unique race guard.
    const r2 = await createRun(req("/api/payroll/runs", "POST", { payPeriodId: period._id }));
    expect(r2.status).toBe(409);

    // The period flipped to "processing".
    const pr = await getPeriod(req(`/api/payroll/pay-periods/${period._id}`), ctx(period._id));
    expect((await pr.json()).data.status).toBe("processing");
  });

  it("walks the run through submit → approve → mark-paid and closes the period", async () => {
    const { period } = await seed();
    const run = (await (await createRun(req("/api/payroll/runs", "POST", { payPeriodId: period._id }))).json()).data.run;

    expect((await submitRun(req(`/api/payroll/runs/${run._id}/submit`, "POST"), ctx(run._id))).status).toBe(200);
    expect((await approveRun(req(`/api/payroll/runs/${run._id}/approve`, "POST"), ctx(run._id))).status).toBe(200);

    const paid = await markPaid(req(`/api/payroll/runs/${run._id}/mark-paid`, "POST"), ctx(run._id));
    expect(paid.status).toBe(200);
    expect((await paid.json()).data.status).toBe("paid");

    const slips = (await (await runPayslips(req(`/api/payroll/runs/${run._id}/payslips`), ctx(run._id))).json()).data;
    expect(slips).toHaveLength(1);
    expect(slips[0].paymentStatus).toBe("paid");

    const pr = await getPeriod(req(`/api/payroll/pay-periods/${period._id}`), ctx(period._id));
    expect((await pr.json()).data.status).toBe("closed");
  });

  it("rejects out-of-order transitions (approve before submit → 409)", async () => {
    const { period } = await seed();
    const run = (await (await createRun(req("/api/payroll/runs", "POST", { payPeriodId: period._id }))).json()).data.run;
    expect((await approveRun(req(`/api/payroll/runs/${run._id}/approve`, "POST"), ctx(run._id))).status).toBe(409);
  });

  it("isolates payroll data across organizations", async () => {
    const { employee } = await seed();
    // Another org's admin must not see this org's employees.
    await setSession({ user: { id: "0000000000000000000000b2", role: "admin", org_id: "0000000000000000000000df" } });
    const emps = (await (await listEmployees(req("/api/payroll/employees?limit=50"))).json()).data;
    expect(emps).toHaveLength(0);
    expect(emps.find((e: { _id: string }) => e._id === employee._id)).toBeUndefined();
  });

  it("denies non-admin roles (manager → 403)", async () => {
    await setSession({ user: { id: "0000000000000000000000c3", role: "manager", org_id: "0000000000000000000000ce" } });
    const res = await listEmployees(req("/api/payroll/employees"));
    expect(res.status).toBe(403);
  });
});
