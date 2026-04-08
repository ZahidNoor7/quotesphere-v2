import { Badge } from "@/components/ui/card";

export function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    issued:    { variant: "info",    label: "Issued" },
    draft:     { variant: "muted",   label: "Draft" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };
  const { variant, label } = map[status] || { variant: "muted", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    complete: { variant: "success",  label: "Paid" },
    partial:  { variant: "warning",  label: "Partial" },
    pending:  { variant: "warning",  label: "Pending" },
    overdue:  { variant: "destructive", label: "Overdue" },
  };
  const { variant, label } = map[status] || { variant: "muted", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function QuotationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    draft:    { variant: "muted",   label: "Draft" },
    pending:  { variant: "warning", label: "Pending" },
    approved: { variant: "success", label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
    invoiced: { variant: "info",    label: "Invoiced" },
    expired:  { variant: "muted",   label: "Expired" },
  };
  const { variant, label } = map[status] || { variant: "muted", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    pending:     { variant: "muted",   label: "Pending" },
    in_progress: { variant: "info",    label: "In Progress" },
    on_hold:     { variant: "warning", label: "On Hold" },
    complete:    { variant: "success", label: "Complete" },
    cancelled:   { variant: "destructive", label: "Cancelled" },
  };
  const { variant, label } = map[status] || { variant: "muted", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ExpenseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    recorded:  { variant: "info",    label: "Recorded" },
    verified:  { variant: "success", label: "Verified" },
    draft:     { variant: "muted",   label: "Draft" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };
  const { variant, label } = map[status] || { variant: "muted", label: status };
  return <Badge variant={variant}>{label}</Badge>;
}
