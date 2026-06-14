"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, CalendarClock, Pause, Play, XCircle, Tags, Clock, Check, X } from "lucide-react";
import { usePlatformTenant, usePlatformPlans } from "@/hooks/use-platform";
import { SubscriptionStatusBadge } from "@/components/platform/subscription-status-badge";
import { TenantActionSheet, type ActionKind } from "@/components/platform/tenant-action-sheet";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { platformMutate } from "@/lib/platform/client";
import { formatCurrency } from "@/lib/utils";
import { CARD, T1, T2, T3, GLASS_BORDER } from "@/lib/ds";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
      <span style={{ fontSize: 12, color: T3 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: T1, fontWeight: 500, textAlign: "right" }}>{children}</span>
    </div>
  );
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { tenant, isLoading, mutate } = usePlatformTenant(id);
  const { plans } = usePlatformPlans();

  const [sheet, setSheet] = useState<{ open: boolean; kind: ActionKind | null }>({ open: false, kind: null });
  const [confirm, setConfirm] = useState<null | "suspend" | "reactivate" | "cancel">(null);
  const [reason, setReason] = useState("");
  const [atPeriodEnd, setAtPeriodEnd] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handlePending(action: "approve_change" | "dismiss_change") {
    setBusy(true);
    try {
      await platformMutate(`/api/platform/tenants/${id}/actions`, "POST", { action });
      toast.success(action === "approve_change" ? "Plan change approved." : "Request dismissed.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const sub = tenant?.subscription;
  const eff = tenant?.effectiveStatus;

  function openSheet(kind: ActionKind) { setSheet({ open: true, kind }); }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      const payload =
        confirm === "suspend" ? { action: "suspend", reason: reason || undefined }
        : confirm === "reactivate" ? { action: "reactivate" }
        : { action: "cancel", atPeriodEnd };
      await platformMutate(`/api/platform/tenants/${id}/actions`, "POST", payload);
      toast.success(
        confirm === "suspend" ? "Tenant suspended."
        : confirm === "reactivate" ? "Tenant reactivated."
        : "Subscription canceled.",
      );
      setConfirm(null); setReason("");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading && !tenant) {
    return <div style={{ color: T3, fontSize: 13, padding: 24 }}>Loading…</div>;
  }
  if (!tenant) {
    return (
      <div style={{ color: T3, fontSize: 13 }}>
        Tenant not found. <Link href="/platform/tenants" style={{ color: "#818cf8" }}>Back to tenants</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 920 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/platform/tenants" style={{ color: T3, display: "flex" }} aria-label="Back to tenants">
          <ArrowLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>{tenant.org.name}</div>
          <div style={{ fontSize: 12, color: T3 }}>{tenant.owner?.email ?? "—"} · {tenant.memberCount} member{tenant.memberCount === 1 ? "" : "s"}</div>
        </div>
        {eff && <SubscriptionStatusBadge status={eff} />}
      </div>

      {/* Pending plan-change request */}
      {sub?.pending_change && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(129,140,248,0.10)", border: "0.5px solid rgba(129,140,248,0.32)", flexWrap: "wrap" }}>
          <Clock size={16} style={{ color: "#a5b4fc", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>
              Pending request: switch to {sub.pending_change.plan_name}{" "}
              <span style={{ color: T3, fontWeight: 400 }}>({sub.pending_change.direction})</span>
            </div>
            <div style={{ fontSize: 11.5, color: T3 }}>
              Requested {fmtDate(sub.pending_change.requested_at)}. Approve applies the plan now — record payment via “Mark paid” if a charge is due.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" onClick={() => handlePending("approve_change")} disabled={busy}><Check size={13} /> Approve</Button>
            <Button variant="outline" size="sm" onClick={() => handlePending("dismiss_change")} disabled={busy}><X size={13} /> Dismiss</Button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {/* Subscription */}
        <div style={{ ...CARD, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <CreditCard size={15} style={{ color: "#818cf8" }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T1 }}>Subscription</span>
          </div>
          {sub ? (
            <>
              <InfoRow label="Plan">{sub.plan_snapshot?.name || "—"}</InfoRow>
              <InfoRow label="Interval">{sub.plan_snapshot?.billing_interval ?? "—"}</InfoRow>
              <InfoRow label="Stored status">{sub.status}</InfoRow>
              <InfoRow label="Effective"><SubscriptionStatusBadge status={eff!} /></InfoRow>
              <InfoRow label="Trial ends">{fmtDate(sub.trial_ends_at)}</InfoRow>
              <InfoRow label="Renews / ends">{fmtDate(sub.current_period_end)}</InfoRow>
              <InfoRow label="Grace override">{sub.grace_period_days_override != null ? `${sub.grace_period_days_override} days` : "default"}</InfoRow>
              <InfoRow label="Features">{sub.plan_snapshot?.features?.length ?? 0} enabled</InfoRow>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: T3 }}>No subscription on record.</div>
          )}
        </div>

        {/* Org info */}
        <div style={{ ...CARD, padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T1, marginBottom: 12 }}>Organization</div>
          <InfoRow label="Owner">{tenant.owner?.name || "—"}</InfoRow>
          <InfoRow label="Owner email">{tenant.owner?.email || "—"}</InfoRow>
          <InfoRow label="Members">{tenant.memberCount}</InfoRow>
          <InfoRow label="Created">{fmtDate(tenant.org.createdAt)}</InfoRow>
          <InfoRow label="Org ID"><span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>{tenant.org._id}</span></InfoRow>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button variant="outline" size="sm" onClick={() => openSheet("change_plan")}><Tags size={13} /> Change plan</Button>
        <Button variant="outline" size="sm" onClick={() => openSheet("set_trial")}><CalendarClock size={13} /> Set / extend trial</Button>
        <Button variant="outline" size="sm" onClick={() => openSheet("mark_paid")}><CreditCard size={13} /> Mark paid</Button>
        <Button variant="outline" size="sm" onClick={() => openSheet("set_grace")}><Clock size={13} /> Grace override</Button>
        {eff === "suspended" ? (
          <Button variant="outline" size="sm" onClick={() => setConfirm("reactivate")}><Play size={13} /> Reactivate</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirm("suspend")}><Pause size={13} /> Suspend</Button>
        )}
        {eff !== "canceled" && eff !== "expired" && (
          <Button variant="outline" size="sm" onClick={() => setConfirm("cancel")}><XCircle size={13} /> Cancel</Button>
        )}
      </div>

      {/* Billing history */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T1, marginBottom: 10 }}>Billing history</div>
        {tenant.payments.length === 0 ? (
          <div style={{ ...CARD, padding: 18, fontSize: 12.5, color: T3, textAlign: "center" }}>No payments recorded.</div>
        ) : (
          <TableWrapper>
            <DataTable>
              <thead>
                <Tr><Th>Date</Th><Th>Amount</Th><Th>Status</Th><Th>Method</Th><Th>Note</Th></Tr>
              </thead>
              <tbody>
                {tenant.payments.map((p) => (
                  <Tr key={p._id}>
                    <Td style={{ color: T2 }}>{fmtDateTime(p.createdAt)}</Td>
                    <Td style={{ color: T1, fontWeight: 500 }}>{formatCurrency(p.amount, p.currency, p.currency === "USD" ? "en-US" : "en-PK")}</Td>
                    <Td style={{ color: T2 }}>{p.status}</Td>
                    <Td style={{ color: T2 }}>{p.method}</Td>
                    <Td style={{ color: T2 }}>{p.description || "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        )}
      </div>

      <TenantActionSheet
        open={sheet.open}
        onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))}
        kind={sheet.kind}
        orgId={id}
        plans={plans}
        currentPlanId={sub?.plan_id}
        currentCurrency={sub?.plan_snapshot?.currency}
        currentGraceOverride={sub?.grace_period_days_override}
        onDone={mutate}
      />

      {/* Confirm dialogs */}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) { setConfirm(null); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "suspend" ? "Suspend this tenant?" : confirm === "reactivate" ? "Reactivate this tenant?" : "Cancel subscription?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "suspend" && "The tenant will be fully blocked from the app immediately."}
              {confirm === "reactivate" && "Access is restored to the tenant's previous state."}
              {confirm === "cancel" && (atPeriodEnd ? "Access continues until the period ends, then expires." : "Access ends immediately.")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirm === "suspend" && (
            <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          {confirm === "cancel" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 12.5, color: T2 }}>Cancel at period end (keep access until then)</span>
              <Switch checked={atPeriodEnd} onCheckedChange={setAtPeriodEnd} />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runConfirm(); }} disabled={busy}>
              {busy ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
