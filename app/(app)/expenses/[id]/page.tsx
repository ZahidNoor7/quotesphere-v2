"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { ExpenseStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD } from "@/lib/ds";
import { SpinnerCenter } from "@/components/loaders";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Expense } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", card: "Card",
  cheque: "Cheque", online: "Online",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending", paid: "Paid", partial: "Partial",
};

const sideTitle = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase" as const, color: T3, marginBottom: 12,
};

export default function ExpenseViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();

  const { data: expense, isLoading } = useSWR<Expense>(`/api/expenses/${id}`, fetcher);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Expense deleted.");
      router.push("/expenses");
    } catch {
      toast.error("Failed to delete expense.");
      setDeleting(false);
    }
  }

  if (isLoading) return <SpinnerCenter height={300} />;
  if (!expense) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
      <div style={{ fontSize: 13, color: T2 }}>Expense not found.</div>
      <Button asChild variant="outline" size="sm"><Link href="/expenses">Back to expenses</Link></Button>
    </div>
  );

  const taxAmt = expense.tax_type === "percentage"
    ? (expense.sub_total * expense.tax) / 100
    : expense.tax;

  const detailRows: [string, string | null | undefined][] = [
    ["Client", expense.customer_name],
    ["Vendor", expense.vendor_name],
    ["Bill date", formatDate(expense.bill_date)],
    ["Bill / Invoice #", expense.bill_number],
    ["Currency", expense.currency],
    ["Payment method", expense.payment_method ? (PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method) : null],
    ["Payment status", PAYMENT_STATUS_LABELS[expense.payment_status] ?? expense.payment_status],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link
            href="/expenses"
            style={{
              display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              padding: "5px 11px", borderRadius: 100,
              background: GLASS, border: `0.5px solid ${GLASS_BORDER}`,
              color: T2, fontSize: 11.5, textDecoration: "none",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M8 2L4 6l4 4"/>
            </svg>
            Expenses
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{expense.expense_no}</div>
          <ExpenseStatusBadge status={expense.status} />
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Button asChild variant="outline" size="sm">
            <Link href={`/expenses/${id}/edit`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Pencil size={12} /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
            onClick={() => setShowDelete(true)}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {/* Body — natural scroll; two-pane (content + sticky sidebar) on desktop */}
      <div style={{ flex: 1, overflowY: "auto", display: isMobile ? "flex" : "grid", flexDirection: "column" as const, gridTemplateColumns: isMobile ? undefined : "1fr 300px", alignItems: isMobile ? undefined : "start", gap: 0 }}>

        {/* Left: items + notes */}
        <div style={{ overflowY: "visible", padding: isMobile ? "14px 12px" : "18px 24px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

          {/* Items */}
          <div style={CARD}>
            <div style={{ padding: "12px 16px 8px", fontSize: 12, fontWeight: 500, color: T1 }}>Expense items</div>
            {isMobile ? (
              expense.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "11px 14px",
                    borderTop: `0.5px solid var(--glass-border)`,
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: T1, fontWeight: 500 }}>{item.name}</span>
                    {item.category && <span style={{ fontSize: 10.5, color: T3 }}>{item.category}</span>}
                    <span style={{ fontSize: 11.5, color: T2 }}>
                      {item.quantity} × {formatCurrency(item.unit_price, expense.currency)}
                    </span>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T1, flexShrink: 0 }}>
                    {formatCurrency(item.total, expense.currency)}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 360 }}>
                  <thead>
                    <tr style={{ background: "var(--glass)" }}>
                      {["Description", "Qty", "Unit price", "Total"].map(h => (
                        <th key={h} style={{ padding: "9px 16px", textAlign: h === "Description" ? "left" : "right", fontSize: 10, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expense.items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T1, fontWeight: 500 }}>
                          {item.name}
                          {item.category && <div style={{ fontSize: 10.5, color: T3, fontWeight: 400, marginTop: 2 }}>{item.category}</div>}
                        </td>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T2, textAlign: "right" }}>{item.quantity}</td>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T2, textAlign: "right" }}>{formatCurrency(item.unit_price, expense.currency)}</td>
                        <td style={{ padding: "11px 16px", borderTop: "0.5px solid var(--glass-border)", color: T1, fontWeight: 600, textAlign: "right" }}>{formatCurrency(item.total, expense.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{ padding: "10px 16px 12px", borderTop: `0.5px solid ${GLASS_BORDER}`, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                <span>Subtotal</span><span>{formatCurrency(expense.sub_total, expense.currency)}</span>
              </div>
              {expense.tax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                  <span>Tax {expense.tax_type === "percentage" ? `(${expense.tax}%)` : ""}</span><span>{formatCurrency(taxAmt, expense.currency)}</span>
                </div>
              )}
              {expense.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#34d399" }}>
                  <span>Discount</span><span>−{formatCurrency(expense.discount, expense.currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 4 }}>
                <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(expense.total_amount, expense.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {expense.notes && (
            <div style={{ ...CARD, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: T3, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Notes</div>
              <div style={{ fontSize: 13, color: T2, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{expense.notes}</div>
            </div>
          )}
        </div>

        {/* Right: sticky info sidebar */}
        <div style={{ borderLeft: isMobile ? "none" : `0.5px solid ${GLASS_BORDER}`, borderTop: isMobile ? `0.5px solid ${GLASS_BORDER}` : "none", overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "14px 12px" : "18px 16px", display: "flex", flexDirection: "column", gap: 12, ...(isMobile ? {} : { position: "sticky" as const, top: 0, alignSelf: "start", maxHeight: "calc(100dvh - 58px)" }) }}>

          {/* Summary */}
          <div style={{ ...CARD, padding: "16px 16px" }}>
            <div style={{ fontSize: 10, color: T3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Total expense</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: AC2, letterSpacing: "-0.02em", marginBottom: 12 }}>{formatCurrency(expense.total_amount, expense.currency)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <ExpenseStatusBadge status={expense.status} />
              <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 100, background: "var(--glass)", color: T2, border: `0.5px solid ${GLASS_BORDER}` }}>
                {PAYMENT_STATUS_LABELS[expense.payment_status] ?? expense.payment_status}
              </span>
            </div>
          </div>

          {/* Details */}
          <div style={{ ...CARD, padding: "14px 15px" }}>
            <div style={sideTitle}>Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {detailRows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, color: T3, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 12, color: T1, fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ ...CARD, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={sideTitle}>Actions</div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/expenses/${id}/edit`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Pencil size={13} /> Edit expense
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
              onClick={() => setShowDelete(true)}
            >
              <Trash2 size={13} className="mr-1.5" /> Delete
            </Button>
          </div>

          {/* Meta */}
          <div style={{ fontSize: 10.5, color: T3, display: "flex", flexDirection: "column", gap: 3, padding: "0 2px" }}>
            <span>Created {formatDate(expense.createdAt)}</span>
            {expense.updatedAt !== expense.createdAt && <span>Updated {formatDate(expense.updatedAt)}</span>}
          </div>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={open => { if (!open) setShowDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {expense.expense_no}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
