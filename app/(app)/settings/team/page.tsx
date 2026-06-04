"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { T1, T3, AC, GLASS, GLASS_BORDER, FIELD_INPUT } from "@/lib/ds";
import { UserPlus, Eye, EyeOff, RefreshCw, Copy, Check, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data);

type Member = { _id: string; name: string; email: string; role: string; createdAt?: string };
type Role = "admin" | "manager" | "staff" | "viewer";

const ROLES: { value: Role; label: string; desc: string; color: string }[] = [
  { value: "admin", label: "Admin", desc: "Full access — settings, delete & manage team", color: "#818cf8" },
  { value: "manager", label: "Manager", desc: "Read, create, update & delete records", color: "#34d399" },
  { value: "staff", label: "Staff", desc: "Read & create records", color: "#60a5fa" },
  { value: "viewer", label: "Viewer", desc: "Read-only access", color: "#94a3b8" },
];
const roleMeta = (r: string) => ROLES.find((x) => x.value === r) ?? { label: r, color: "#94a3b8", desc: "" };

/** A reasonably strong, human-typable password (ambiguous chars excluded). */
function genPassword(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

const emptyForm = { name: "", email: "", password: "", role: "staff" as Role };

function RoleBadge({ role }: { role: string }) {
  const m = roleMeta(role);
  return (
    <span
      style={{
        fontSize: 10.5,
        padding: "2px 9px",
        borderRadius: 100,
        textTransform: "capitalize",
        background: `${m.color}26`,
        color: m.color,
        border: `0.5px solid ${m.color}40`,
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  );
}

const roleSelectStyle: React.CSSProperties = {
  ...FIELD_INPUT,
  height: 30,
  padding: "3px 8px",
  fontSize: 11.5,
  width: "auto",
  cursor: "pointer",
};

export default function TeamSettingsPage() {
  const { data: members, mutate, isLoading } = useSWR<Member[]>("/api/team", fetcher);
  const { data: me } = useSWR("/api/profile", fetcher);
  const isAdmin = me?.role === "admin";
  const canManage = (u: Member) => isAdmin && u._id !== me?.id;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function openAdd() {
    setForm({ ...emptyForm, password: genPassword() });
    setShowPwd(true);
    setCopied(false);
    setOpen(true);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : (Object.values(data.error ?? {}).flat()[0] as string) ?? "Failed to add member";
        throw new Error(msg);
      }
      toast.success(`${form.name} added — share their email & password so they can sign in.`);
      setOpen(false);
      setForm(emptyForm);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(u: Member, role: string) {
    if (role === u.role) return;
    setBusyId(u._id);
    try {
      const res = await fetch(`/api/team/${u._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Failed to change role");
      toast.success(`${u.name} is now ${roleMeta(role).label}.`);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change role");
      mutate(); // revert the optimistic <select> value to the server's
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    const u = removeTarget;
    if (!u) return;
    setBusyId(u._id);
    try {
      const res = await fetch(`/api/team/${u._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Failed to remove member");
      toast.success(`${u.name} removed from the team.`);
      setRemoveTarget(null);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setBusyId(null);
    }
  }

  const list = Array.isArray(members) ? members : [];

  return (
    <>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: T1,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>Team &amp; roles</span>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} style={{ cursor: "pointer" }}>
            <UserPlus size={14} style={{ marginRight: 6 }} /> Add member
          </Button>
        )}
      </div>

      <div style={{ fontSize: 12, color: T3, marginBottom: 14, marginTop: -6 }}>
        Roles control what each member can do.{" "}
        <Link href="/docs/team-roles" style={{ color: AC, textDecoration: "underline" }}>
          See what each role can do
        </Link>
        .
      </div>

      {isLoading ? (
        <div style={{ fontSize: 12, color: T3, padding: "16px 4px" }}>Loading team…</div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((u) => (
            <div key={u._id} style={{ padding: "12px 14px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>
                  {u.name}
                  {u._id === me?.id && <span style={{ color: T3, fontWeight: 400 }}> (You)</span>}
                </div>
                <RoleBadge role={u.role} />
              </div>
              <div style={{ fontSize: 12, color: T3 }}>{u.email}</div>
              {canManage(u) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <select
                    aria-label={`Role for ${u.name}`}
                    value={u.role}
                    disabled={busyId === u._id}
                    onChange={(e) => changeRole(u, e.target.value)}
                    style={{ ...roleSelectStyle, flex: 1, width: "auto" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" disabled={busyId === u._id} onClick={() => setRemoveTarget(u)} aria-label={`Remove ${u.name}`} style={{ cursor: "pointer", color: "#f87171" }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--glass)" }}>
                {["Member", "Email", "Role", ""].map((h, i) => (
                  <th key={h || i} style={{ padding: "9px 12px", textAlign: i === 3 ? "right" : "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u._id}>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", color: T1, fontWeight: 500 }}>
                    {u.name}
                    {u._id === me?.id && <span style={{ color: T3, fontWeight: 400 }}> (You)</span>}
                  </td>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", color: T3 }}>{u.email}</td>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)" }}>
                    {canManage(u) ? (
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={busyId === u._id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        style={roleSelectStyle}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={u.role} />
                    )}
                  </td>
                  <td style={{ padding: "6px 12px", borderTop: "0.5px solid var(--glass-border)", textAlign: "right" }}>
                    {canManage(u) && (
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(u)}
                        disabled={busyId === u._id}
                        aria-label={`Remove ${u.name}`}
                        title="Remove member"
                        style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 6, display: "inline-flex", borderRadius: 8 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--t3)")}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add member dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              They can sign in immediately with the email and password you set — no invite needed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="tm-name">Full name</Label>
              <Input id="tm-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" required autoComplete="off" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="tm-email">Email</Label>
              <Input id="tm-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" required autoComplete="off" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="tm-password">Password</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Input
                    id="tm-password"
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    style={{ paddingRight: 64 }}
                  />
                  <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 2 }}>
                    <button type="button" onClick={() => setShowPwd((s) => !s)} aria-label={showPwd ? "Hide password" : "Show password"} style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 4, display: "flex" }}>
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button type="button" onClick={copyPassword} aria-label="Copy password" style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#34d399" : T3, padding: 4, display: "flex" }}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setForm((f) => ({ ...f, password: genPassword() })); setShowPwd(true); }} style={{ cursor: "pointer", flexShrink: 0 }} title="Generate a strong password">
                  <RefreshCw size={14} />
                </Button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="tm-role">Role</Label>
              <select
                id="tm-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                style={{ ...FIELD_INPUT, cursor: "pointer", height: 38 }}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: T3 }}>{roleMeta(form.role).desc}</span>
            </div>

            <DialogFooter style={{ marginTop: 4 }}>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting} style={{ cursor: "pointer" }}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} style={{ cursor: "pointer" }}>
                {submitting ? "Adding…" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              {removeTarget ? (
                <>
                  <strong style={{ color: T1 }}>{removeTarget.name}</strong> ({removeTarget.email}) will lose access to
                  this organization immediately. Records they created stay with the organization. This can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter style={{ marginTop: 4 }}>
            <Button type="button" variant="ghost" onClick={() => setRemoveTarget(null)} disabled={!!busyId} style={{ cursor: "pointer" }}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove} disabled={!!busyId} style={{ cursor: "pointer" }}>
              {busyId ? "Removing…" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
