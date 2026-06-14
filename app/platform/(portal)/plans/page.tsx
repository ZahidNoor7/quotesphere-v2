"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { usePlatformPlans } from "@/hooks/use-platform";
import { PlanSheet } from "@/components/platform/plan-sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { platformMutate } from "@/lib/platform/client";
import { formatCurrency } from "@/lib/utils";
import { CARD, T1, T2, T3, GLASS_BORDER } from "@/lib/ds";
import type { Plan } from "@/types";

export default function PlansPage() {
  const { plans, isLoading, mutate } = usePlatformPlans();
  const [sheet, setSheet] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [toDelete, setToDelete] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await platformMutate(`/api/platform/plans/${toDelete._id}`, "DELETE");
      toast.success("Plan deleted.");
      setToDelete(null);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>Plans</div>
          <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>The catalog tenants choose from. Edits never alter live subscriptions (frozen snapshots).</div>
        </div>
        <Button size="sm" onClick={() => setSheet({ open: true, plan: null })}><Plus size={14} /> New plan</Button>
      </div>

      {isLoading && plans.length === 0 ? (
        <div style={{ color: T3, fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {plans.map((p) => (
            <div key={p._id} style={{ ...CARD, padding: 18, display: "flex", flexDirection: "column", gap: 10, opacity: p.is_active ? 1 : 0.62 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T1 }}>{p.name}</span>
                  {p.is_grandfather && <Lock size={12} style={{ color: T3 }} />}
                </div>
                <span style={{ fontSize: 11, color: T3, textTransform: "capitalize" }}>{p.billing_interval}</span>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div><div style={{ fontSize: 10.5, color: T3 }}>PKR</div><div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{formatCurrency(p.price_pkr, "PKR", "en-PK")}</div></div>
                <div><div style={{ fontSize: 10.5, color: T3 }}>USD</div><div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{formatCurrency(p.price_usd, "USD", "en-US")}</div></div>
              </div>
              <div style={{ fontSize: 12, color: T2 }}>{p.features.length} feature{p.features.length === 1 ? "" : "s"} · {p.is_active ? "Active" : "Inactive"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 2, borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 10 }}>
                <Button variant="outline" size="sm" onClick={() => setSheet({ open: true, plan: p })}><Pencil size={12} /> Edit</Button>
                {!p.is_grandfather && (
                  <Button variant="outline" size="sm" onClick={() => setToDelete(p)} style={{ color: "#f87171" }}><Trash2 size={12} /> Delete</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanSheet open={sheet.open} onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))} plan={sheet.plan} onSaved={mutate} />

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing subscriptions keep their frozen snapshot, so they are unaffected. This only removes the catalog entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={busy}>
              {busy ? "Deleting…" : "Delete plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
