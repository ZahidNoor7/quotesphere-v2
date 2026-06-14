"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";
import { usePlatformSettings, usePlatformInvites, usePlatformPlans } from "@/hooks/use-platform";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { platformMutate } from "@/lib/platform/client";
import { CARD, T1, T2, T3, GLASS_BORDER } from "@/lib/ds";

const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 5, display: "block" } as const;
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function PlatformSettingsPage() {
  const { settings, mutate } = usePlatformSettings();
  const { invites, mutate: mutateInvites } = usePlatformInvites();
  const { plans } = usePlatformPlans();

  const [trial, setTrial] = useState("");
  const [grace, setGrace] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => {
    if (settings) {
      setTrial(String(settings.default_trial_days));
      setGrace(String(settings.default_grace_period_days));
      setCurrency(settings.default_currency);
    }
  }, [settings]);

  async function saveDefaults() {
    setSavingDefaults(true);
    try {
      await platformMutate("/api/platform/settings", "PUT", {
        default_trial_days: Number(trial),
        default_grace_period_days: Number(grace),
        default_currency: currency,
      });
      toast.success("Platform defaults saved.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingDefaults(false);
    }
  }

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTrial, setInviteTrial] = useState("");
  const [invitePlan, setInvitePlan] = useState("none");
  const [inviteExpiry, setInviteExpiry] = useState("14");
  const [creating, setCreating] = useState(false);
  const planOpts = plans.filter((p) => p.is_active && !p.is_grandfather);

  async function createInvite() {
    if (!inviteEmail) return toast.error("Enter an email.");
    setCreating(true);
    try {
      await platformMutate("/api/platform/invites", "POST", {
        email: inviteEmail,
        trialDays: inviteTrial ? Number(inviteTrial) : undefined,
        planId: invitePlan !== "none" ? invitePlan : undefined,
        expiresInDays: Number(inviteExpiry) || 14,
      });
      toast.success("Invite created.");
      setInviteEmail(""); setInviteTrial(""); setInvitePlan("none");
      mutateInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite");
    } finally {
      setCreating(false);
    }
  }

  function copyToken(token: string) {
    navigator.clipboard?.writeText(token).then(
      () => toast.success("Invite token copied."),
      () => toast.error("Copy failed."),
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>Platform settings</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Global trial &amp; billing defaults, and pre-signup invites.</div>
      </div>

      {/* Defaults */}
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T1, marginBottom: 14 }}>Defaults</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Default trial (days)</label>
            <Input type="number" min={0} inputMode="numeric" value={trial} onChange={(e) => setTrial(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Past-due grace (days)</label>
            <Input type="number" min={0} inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Default currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="PKR">PKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={saveDefaults} loading={savingDefaults}>Save defaults</Button>
      </div>

      {/* Invite */}
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T1, marginBottom: 4 }}>Create invite</div>
        <div style={{ fontSize: 11.5, color: T3, marginBottom: 14 }}>Pre-set a trial length (and optional plan) for a tenant who hasn’t signed up yet. Applied automatically when they register with this email.</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Email</label>
            <Input type="email" placeholder="founder@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Trial days</label>
            <Input type="number" min={0} inputMode="numeric" placeholder="default" value={inviteTrial} onChange={(e) => setInviteTrial(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Plan</label>
            <Select value={invitePlan} onValueChange={setInvitePlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="none">None</SelectItem>
                {planOpts.map((p) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
          </div>
          <div>
            <label style={lbl}>Expires (days)</label>
            <Input type="number" min={1} inputMode="numeric" value={inviteExpiry} onChange={(e) => setInviteExpiry(e.target.value)} />
          </div>
        </div>
        <Button onClick={createInvite} loading={creating}><Send size={13} /> Create invite</Button>
      </div>

      {/* Invites list */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T1, marginBottom: 10 }}>Invites</div>
        {invites.length === 0 ? (
          <div style={{ ...CARD, padding: 18, fontSize: 12.5, color: T3, textAlign: "center" }}>No invites yet.</div>
        ) : (
          <TableWrapper>
            <DataTable>
              <thead>
                <Tr><Th>Email</Th><Th>Trial</Th><Th>Plan</Th><Th>Status</Th><Th>Expires</Th><Th>Token</Th></Tr>
              </thead>
              <tbody>
                {invites.map((iv) => (
                  <Tr key={iv._id}>
                    <Td style={{ color: T1, fontWeight: 500 }}>{iv.email}</Td>
                    <Td style={{ color: T2 }}>{iv.trial_days_override != null ? `${iv.trial_days_override}d` : "default"}</Td>
                    <Td style={{ color: T2 }}>{iv.plan?.name ?? "—"}</Td>
                    <Td style={{ color: T2, textTransform: "capitalize" }}>{iv.status}</Td>
                    <Td style={{ color: T2 }}>{fmtDate(iv.expires_at)}</Td>
                    <Td>
                      <button onClick={() => copyToken(iv.token)} aria-label="Copy invite token"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", background: "none", border: "none", color: "#818cf8", fontSize: 11.5 }}>
                        <Copy size={12} /> copy
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
