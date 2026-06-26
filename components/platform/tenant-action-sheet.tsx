"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { platformMutate } from "@/lib/platform/client";
import { GLASS_BORDER, T3 } from "@/lib/ds";
import type { Plan, BillingCurrency } from "@/types";

export type ActionKind = "change_plan" | "set_trial" | "mark_paid" | "set_grace";

const META: Record<ActionKind, { title: string; desc: string; cta: string }> = {
  change_plan: { title: "Change plan", desc: "Assign a different plan. Pricing & features are re-snapshotted onto the subscription.", cta: "Change plan" },
  set_trial:   { title: "Set / extend trial", desc: "Put this tenant on a trial for N days from now.", cta: "Set trial" },
  mark_paid:   { title: "Mark as paid", desc: "Record a manual payment and start a fresh billing period (activates access).", cta: "Mark paid" },
  set_grace:   { title: "Grace override", desc: "Override the past-due grace window for this tenant only. Leave blank to use the platform default.", cta: "Save" },
};

interface FormState {
  planId: string;
  currency: BillingCurrency;
  trialDays: string;
  amount: string;
  note: string;
  graceDays: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: ActionKind | null;
  orgId: string;
  plans: Plan[];
  currentPlanId?: string;
  currentCurrency?: BillingCurrency;
  currentGraceOverride?: number | null;
  onDone: () => void;
}

export function TenantActionSheet({
  open, onOpenChange, kind, orgId, plans, currentPlanId, currentCurrency, currentGraceOverride, onDone,
}: Props) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(() => initial());
  const initialRef = useRef<string>("");
  // Stable per-open idempotency token so a double-click / retry of "Mark paid"
  // records the payment exactly once (see the actions route's idempotency_key).
  const idemKeyRef = useRef<string>("");

  function initial(): FormState {
    return {
      planId: currentPlanId ?? "",
      currency: currentCurrency ?? "PKR",
      trialDays: "14",
      amount: "",
      note: "",
      graceDays: currentGraceOverride != null ? String(currentGraceOverride) : "",
    };
  }

  useEffect(() => {
    if (open) {
      const init = initial();
      setForm(init);
      initialRef.current = JSON.stringify(init);
      idemKeyRef.current = crypto.randomUUID();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const dirty = JSON.stringify(form) !== initialRef.current;
  useUnsavedChanges(open && dirty && !submitting, () => setConfirmOpen(true));

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function requestClose(next: boolean) {
    if (!next && dirty && !submitting) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    onOpenChange(false);
  }

  async function submit() {
    if (!kind) return;
    let payload: Record<string, unknown> | null = null;
    if (kind === "change_plan") {
      if (!form.planId) return toast.error("Select a plan.");
      payload = { action: "change_plan", planId: form.planId, currency: form.currency };
    } else if (kind === "set_trial") {
      const n = Number(form.trialDays);
      if (!Number.isFinite(n) || n < 0) return toast.error("Enter a valid number of days.");
      payload = { action: "set_trial", trialDays: n };
    } else if (kind === "mark_paid") {
      const amt = Number(form.amount);
      if (!Number.isFinite(amt) || amt < 0) return toast.error("Enter a valid amount.");
      payload = {
        action: "mark_paid", amount: amt, currency: form.currency,
        planId: form.planId || undefined, note: form.note || undefined,
        idempotencyKey: idemKeyRef.current || undefined,
      };
    } else if (kind === "set_grace") {
      payload = { action: "set_grace", graceDays: form.graceDays === "" ? null : Number(form.graceDays) };
    }
    if (!payload) return;
    setSubmitting(true);
    try {
      await platformMutate(`/api/platform/tenants/${orgId}/actions`, "POST", payload);
      initialRef.current = JSON.stringify(form); // clear dirty before close
      toast.success(`${META[kind].title} applied.`);
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const label = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 5, display: "block" } as const;
  const planOpts = plans.filter((p) => p.is_active && !p.is_grandfather);

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={(e) => { if (dirty && !submitting) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (dirty && !submitting) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile
            ? "flex flex-col p-0 gap-0 h-[80dvh] overflow-hidden rounded-t-2xl"
            : "flex flex-col p-0 gap-0 sm:w-[440px] sm:max-w-[440px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{kind ? META[kind].title : ""}</SheetTitle>
            <SheetDescription>{kind ? META[kind].desc : ""}</SheetDescription>
          </SheetHeader>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {(kind === "change_plan" || kind === "mark_paid") && (
              <div>
                <label style={label}>{kind === "mark_paid" ? "Plan (optional — keep current if unchanged)" : "Plan"}</label>
                <Select value={form.planId} onValueChange={(v) => set("planId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {planOpts.map((p) => (
                        <SelectItem key={p._id} value={p._id}>{p.name} · {p.billing_interval}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(kind === "change_plan" || kind === "mark_paid") && (
              <div>
                <label style={label}>Billing currency</label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v as BillingCurrency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {kind === "mark_paid" && (
              <>
                <div>
                  <label style={label}>Amount</label>
                  <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0"
                    value={form.amount} onChange={(e) => set("amount", e.target.value)} autoFocus />
                </div>
                <div>
                  <label style={label}>Note (optional)</label>
                  <Textarea rows={2} placeholder="e.g. Bank transfer ref #1234"
                    value={form.note} onChange={(e) => set("note", e.target.value)} />
                </div>
              </>
            )}

            {kind === "set_trial" && (
              <div>
                <label style={label}>Trial length (days from now)</label>
                <Input type="number" min={0} step="1" inputMode="numeric" placeholder="14"
                  value={form.trialDays} onChange={(e) => set("trialDays", e.target.value)} autoFocus />
              </div>
            )}

            {kind === "set_grace" && (
              <div>
                <label style={label}>Grace days override (blank = platform default)</label>
                <Input type="number" min={0} step="1" inputMode="numeric" placeholder="default"
                  value={form.graceDays} onChange={(e) => set("graceDays", e.target.value)} autoFocus />
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" loading={submitting} onClick={submit}>{kind ? META[kind].cta : "Save"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. If you leave now they will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndClose}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
