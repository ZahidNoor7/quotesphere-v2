import { redirect } from "next/navigation";

// Payroll landing → the runs screen (the primary working surface).
export default function PayrollIndexPage() {
  redirect("/payroll/runs");
}
