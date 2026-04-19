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
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE } from "@/lib/ds";
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

  const secTitle = {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase" as const, color: T3,
    marginBottom: 10, paddingBottom: 6, borderBottom: `0.5px solid ${GLASS_BORDER}`,
  };
  const row = { display: "flex", flexDirection: "column" as const, gap: 2 };
  const lbl = { fontSize: 10, color: T3, fontWeight: 500 };
  const val = { fontSize: 12.5, color: T1, fontWeight: 500 };

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

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "18px 20px", maxWidth: 700, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Details */}
          <div>
            <div style={secTitle}>Expense details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
              <div style={row}>
                <span style={lbl}>Client</span>
                <span style={val}>{expense.customer_name}</span>
              </div>
              <div style={row}>
                <span style={lbl}>Bill date</span>
                <span style={val}>{formatDate(expense.bill_date)}</span>
              </div>
              {expense.vendor_name && (
                <div style={row}>
                  <span style={lbl}>Vendor</span>
                  <span style={val}>{expense.vendor_name}</span>
                </div>
              )}
              {expense.bill_number && (
                <div style={row}>
                  <span style={lbl}>Bill / Invoice #</span>
                  <span style={val}>{expense.bill_number}</span>
                </div>
              )}
              <div style={row}>
                <span style={lbl}>Currency</span>
                <span style={val}>{expense.currency}</span>
              </div>
              {expense.payment_method && (
                <div style={row}>
                  <span style={lbl}>Payment method</span>
                  <span style={val}>{PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method}</span>
                </div>
              )}
              <div style={row}>
                <span style={lbl}>Payment status</span>
                <span style={val}>{PAYMENT_STATUS_LABELS[expense.payment_status] ?? expense.payment_status}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div style={secTitle}>Expense items</div>
            <div style={{ borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
              {isMobile ? (
                /* Mobile item list */
                <>
                  {expense.items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        borderTop: i > 0 ? `0.5px solid rgba(255,255,255,0.04)` : "none",
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                        <span style={{ fontSize: 12.5, color: T1 }}>{item.name}</span>
                        {item.category && <span style={{ fontSize: 10, color: T3 }}>{item.category}</span>}
                        <span style={{ fontSize: 11, color: T2 }}>
                          {item.quantity} × {formatCurrency(item.unit_price, expense.currency)}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T1, flexShrink: 0 }}>
                        {formatCurrency(item.total, expense.currency)}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                /* Desktop grid */
                <>
                  <div style={{
                    display: "grid", gridTemplateColumns: "3fr 52px 85px 75px",
                    gap: 5, padding: "6px 10px",
                    fontSize: 9.5, fontWeight: 500, letterSpacing: "0.05em",
                    textTransform: "uppercase", color: T3,
                    background: "rgba(255,255,255,0.025)",
                  }}>
                    <span>Description</span>
                    <span style={{ textAlign: "center" }}>Qty</span>
                    <span style={{ textAlign: "right" }}>Unit price</span>
                    <span style={{ textAlign: "right" }}>Total</span>
                  </div>
                  {expense.items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid", gridTemplateColumns: "3fr 52px 85px 75px",
                        gap: 5, padding: "8px 10px",
                        borderTop: `0.5px solid rgba(255,255,255,0.04)`,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 12, color: T1 }}>{item.name}</span>
                        {item.category && (
                          <span style={{ fontSize: 10, color: T3 }}>{item.category}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: T2, textAlign: "center" }}>{item.quantity}</span>
                      <span style={{ fontSize: 11, color: T2, textAlign: "right" }}>{formatCurrency(item.unit_price, expense.currency)}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: T1, textAlign: "right" }}>{formatCurrency(item.total, expense.currency)}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Totals */}
              <div style={{ padding: "10px 14px", borderTop: `0.5px solid ${GLASS_BORDER}`, background: "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(expense.sub_total, expense.currency)}</span>
                </div>
                {expense.tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                    <span>Tax {expense.tax_type === "percentage" ? `(${expense.tax}%)` : ""}</span>
                    <span>{formatCurrency(taxAmt, expense.currency)}</span>
                  </div>
                )}
                {expense.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                    <span>Discount</span>
                    <span>−{formatCurrency(expense.discount, expense.currency)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span>
                  <span style={{ color: AC2 }}>{formatCurrency(expense.total_amount, expense.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {expense.notes && (
            <div>
              <div style={secTitle}>Notes</div>
              <div style={{ fontSize: 12.5, color: T2, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{expense.notes}</div>
            </div>
          )}

          {/* Meta */}
          <div style={{ fontSize: 10.5, color: T3, display: "flex", gap: 16 }}>
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
