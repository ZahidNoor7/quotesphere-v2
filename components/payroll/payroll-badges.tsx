import { Badge } from "@/components/ui/card";

type Variant = "muted" | "warning" | "success" | "destructive" | "info" | "outline";

function toLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const RUN: Record<string, { variant: Variant; label: string }> = {
  draft: { variant: "muted", label: "Draft" },
  pending_approval: { variant: "warning", label: "Pending approval" },
  approved: { variant: "info", label: "Approved" },
  paid: { variant: "success", label: "Paid" },
  cancelled: { variant: "destructive", label: "Cancelled" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const m = RUN[status] ?? { variant: "outline" as Variant, label: toLabel(status) };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

const PERIOD: Record<string, { variant: Variant; label: string }> = {
  open: { variant: "info", label: "Open" },
  processing: { variant: "warning", label: "Processing" },
  closed: { variant: "muted", label: "Closed" },
};

export function PeriodStatusBadge({ status }: { status: string }) {
  const m = PERIOD[status] ?? { variant: "outline" as Variant, label: toLabel(status) };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

const PAYSLIP: Record<string, { variant: Variant; label: string }> = {
  unpaid: { variant: "warning", label: "Unpaid" },
  paid: { variant: "success", label: "Paid" },
};

export function PayslipStatusBadge({ status }: { status: string }) {
  const m = PAYSLIP[status] ?? { variant: "outline" as Variant, label: toLabel(status) };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
