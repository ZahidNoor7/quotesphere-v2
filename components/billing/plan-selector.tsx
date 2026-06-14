"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, Minus, Clock, ShieldAlert, ArrowUpRight, ArrowDownRight, ArrowRightLeft, RotateCcw, X } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { SubscriptionStatusBadge } from "@/components/platform/subscription-status-badge";
import { GATEABLE_FEATURES } from "@/lib/entitlements/features";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { CARD, T1, T2, T3, GLASS_BORDER } from "@/lib/ds";
import type { Plan } from "@/types";

const INCLUDED = "#34d399";
const ACCENT = "#818cf8";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const intervalSuffix = (i: string) => (i === "monthly" ? "/mo" : i === "annual" ? "/yr" : "");

/**
 * Shared plan comparison + request UI. Used on the tenant Settings → Plan page and
 * on the expired/blocked screen (so a blocked tenant can request a renewal). When
 * blocked, the current plan offers "Request renewal"; otherwise it's marked current.
 */
export function PlanSelector({ showCurrent = true }: { showCurrent?: boolean }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { billing, isLoading, mutate } = useBilling();

  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);

  if (!isAdmin) {
    return (
      <div style={{ ...CARD, padding: 20, display: "flex", alignItems: "center", gap: 10, color: T3 }}>
        <ShieldAlert size={18} />
        <span style={{ fontSize: 13 }}>Plan &amp; billing is managed by your organization admin.</span>
      </div>
    );
  }

  const pending = billing?.pending_change ?? null;
  const currentSlug = billing?.plan_snapshot?.slug;
  const currentPricePkr = billing?.plan_snapshot?.price_pkr ?? 0;
  const currentFeatureCount = billing?.plan_snapshot?.features?.length ?? 0;
  const blocked = billing?.effectiveStatus === "expired" || billing?.effectiveStatus === "suspended";

  const directionFor = (plan: Plan): "upgrade" | "downgrade" | "change" =>
    plan.price_pkr > currentPricePkr ? "upgrade" : plan.price_pkr < currentPricePkr ? "downgrade" : "change";

  async function submitRequest() {
    if (!confirmPlan) return;
    setBusy(true);
    try {
      const res = await fetch("/api/billing/change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: confirmPlan._id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not submit request");
      toast.success("Request sent — your provider will review it.");
      setConfirmPlan(null);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    setCanceling(true);
    try {
      const res = await fetch("/api/billing/change-request", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not cancel");
      toast.success("Request canceled.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setCanceling(false);
    }
  }

  const subStatusLine =
    billing?.effectiveStatus === "trialing"
      ? `Trial ends ${fmtDate(billing?.trial_ends_at)}`
      : billing?.current_period_end
        ? `Renews ${fmtDate(billing?.current_period_end)}`
        : billing?.effectiveStatus === "expired"
          ? "Expired"
          : "No expiry";

  const confirmIsRenewal = confirmPlan && confirmPlan.slug === currentSlug;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showCurrent && (
        <div style={{ ...CARD, padding: "16px 18px" }}>
          {isLoading && !billing ? (
            <div style={{ fontSize: 13, color: T3 }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T3, marginBottom: 6 }}>Current plan</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 19, fontWeight: 700, color: T1 }}>{billing?.plan_snapshot?.name || "—"}</span>
                  {billing && <SubscriptionStatusBadge status={billing.effectiveStatus} />}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: T2 }}>{subStatusLine}</div>
                <div style={{ fontSize: 11.5, color: T3, marginTop: 2 }}>{currentFeatureCount} feature{currentFeatureCount === 1 ? "" : "s"} included</div>
              </div>
            </div>
          )}
        </div>
      )}

      {pending && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(129,140,248,0.10)", border: "0.5px solid rgba(129,140,248,0.3)" }}>
          <Clock size={15} style={{ color: "#a5b4fc", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T1 }}>
              Plan change requested: {pending.plan_name}{" "}
              <span style={{ color: T3, fontWeight: 400 }}>· {pending.direction}</span>
            </div>
            <div style={{ fontSize: 11.5, color: T3 }}>
              Awaiting your provider&apos;s approval — we&apos;ll apply it (and restore access if needed) once it&apos;s approved.
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={cancelRequest} loading={canceling}><X size={13} /> Cancel</Button>
        </div>
      )}

      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T1, marginBottom: 12 }}>Available plans</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "stretch" }}>
          {(billing?.plans ?? []).map((plan) => {
            const isCurrent = plan.slug === currentSlug;
            const isFree = plan.price_pkr === 0 && plan.price_usd === 0;
            const dir = directionFor(plan);
            const DirIcon = dir === "upgrade" ? ArrowUpRight : dir === "downgrade" ? ArrowDownRight : ArrowRightLeft;
            const requestedThis = pending && (pending.plan_id === plan._id || pending.plan_name === plan.name);

            return (
              <div
                key={plan._id}
                style={{
                  ...CARD, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden",
                  border: isCurrent ? `1px solid ${ACCENT}` : (CARD as React.CSSProperties).border,
                  boxShadow: isCurrent ? "0 0 0 3px rgba(129,140,248,0.16)" : undefined,
                }}
              >
                <div style={{ padding: "18px 18px 16px", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: T1 }}>{plan.name}</span>
                    {isCurrent ? (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: ACCENT, background: "rgba(129,140,248,0.14)", padding: "2px 8px", borderRadius: 999 }}>Current</span>
                    ) : (
                      <span style={{ fontSize: 10.5, color: T3, textTransform: "capitalize" }}>{plan.billing_interval}</span>
                    )}
                  </div>
                  {isFree ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: T1, lineHeight: 1 }}>Free</span>
                      <span style={{ fontSize: 12, color: T3 }}>forever</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, color: T1, lineHeight: 1 }}>{formatCurrency(plan.price_pkr, "PKR", "en-PK")}</span>
                        <span style={{ fontSize: 13, color: T3 }}>{intervalSuffix(plan.billing_interval)}</span>
                      </div>
                      <span style={{ fontSize: 12, color: T3 }}>≈ {formatCurrency(plan.price_usd, "USD", "en-US")} {plan.billing_interval}</span>
                    </div>
                  )}
                  {plan.description && <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.5, marginTop: 10 }}>{plan.description}</div>}
                </div>

                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
                  {GATEABLE_FEATURES.map((f) => {
                    const has = plan.features.includes(f.key);
                    return (
                      <div key={f.key} title={has ? "Included" : "Not included"} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", fontSize: 12.5 }}>
                        {has ? <Check size={14} strokeWidth={2.4} style={{ color: INCLUDED, flexShrink: 0 }} /> : <Minus size={14} style={{ color: T3, opacity: 0.5, flexShrink: 0 }} />}
                        <span style={{ color: has ? T1 : T3, opacity: has ? 1 : 0.7 }}>{f.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: "0 18px 18px" }}>
                  {isCurrent && !blocked ? (
                    <Button variant="outline" size="sm" disabled className="w-full"><Check size={13} /> Current plan</Button>
                  ) : pending ? (
                    <Button variant="outline" size="sm" disabled className="w-full">{requestedThis ? "Requested" : "Request pending"}</Button>
                  ) : isCurrent && blocked ? (
                    <Button size="sm" className="w-full" onClick={() => setConfirmPlan(plan)}><RotateCcw size={13} /> Request renewal</Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setConfirmPlan(plan)}>
                      <DirIcon size={13} /> {dir === "upgrade" ? "Request upgrade" : dir === "downgrade" ? "Request downgrade" : "Request switch"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!isLoading && (billing?.plans?.length ?? 0) === 0 && (
          <div style={{ ...CARD, padding: 18, fontSize: 12.5, color: T3, textAlign: "center" }}>No plans are available yet.</div>
        )}
      </div>

      <AlertDialog open={confirmPlan !== null} onOpenChange={(o) => { if (!o) setConfirmPlan(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmIsRenewal ? `Request renewal of ${confirmPlan?.name}?` : `Request switch to ${confirmPlan?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This sends a request to your provider. They&apos;ll review and apply it — nothing changes until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); submitRequest(); }} disabled={busy}>
              {busy ? "Sending…" : "Send request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
