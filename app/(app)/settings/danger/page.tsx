"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { Trash2, AlertTriangle, RotateCcw, Users, FileText, Receipt, Briefcase, TrendingDown, Wrench } from "lucide-react";

type DeleteType = "invoices" | "quotations" | "expenses" | "projects" | "customers" | "services" | "all";

const SECTIONS: { type: DeleteType; label: string; description: string; icon: React.ElementType; confirmWord?: string }[] = [
  {
    type: "invoices", label: "All Invoices", icon: FileText,
    description: "Delete every invoice and its payment history. Cannot be undone.",
  },
  {
    type: "quotations", label: "All Quotations", icon: Receipt,
    description: "Delete every quotation. Cannot be undone.",
  },
  {
    type: "expenses", label: "All Expenses", icon: TrendingDown,
    description: "Delete every expense record. Cannot be undone.",
  },
  {
    type: "projects", label: "All Projects", icon: Briefcase,
    description: "Delete every project. Linked invoices/quotations/expenses are NOT deleted.",
  },
  {
    type: "customers", label: "All Customers", icon: Users,
    description: "Delete every customer record. Cannot be undone.",
  },
  {
    type: "services", label: "All Services", icon: Wrench,
    description: "Delete every service in the catalogue. Cannot be undone.",
  },
];

function DangerCard({
  type, label, description, icon: Icon, onDeleted,
}: { type: DeleteType; label: string; description: string; icon: React.ElementType; onDeleted: (t: DeleteType, results: Record<string, number>) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/bulk-delete?type=${type}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setOpen(false);
      onDeleted(type, data.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ padding: "14px 16px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "0.5px solid rgba(248,113,113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#f87171" }}>
          <Icon size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{label}</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{description}</div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)} style={{ flexShrink: 0 }}>
          <Trash2 size={12} className="mr-1.5" />Delete all
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#f87171" }}>Delete {label}?</DialogTitle>
            <DialogDescription>{description} This action is permanent and cannot be undone.</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={loading} onClick={doDelete}>
              Yes, delete all
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DangerSettingsPage() {
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  function handleDeleted(type: DeleteType, results: Record<string, number>) {
    const count = results[type] ?? 0;
    toast.success(`Deleted ${count} ${type} successfully.`);
  }

  async function doFullReset() {
    if (resetConfirm !== "RESET") return;
    setResetting(true);
    try {
      const res = await fetch("/api/settings/bulk-delete?type=all", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResetOpen(false);
      setResetConfirm("");
      const total = Object.values(data.data as Record<string, number>).reduce((a, b) => a + b, 0);
      toast.success(`Application reset complete. Removed ${total} records.`);
    } catch (err: any) {
      toast.error(err.message || "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
      {/* Individual delete sections */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T2, marginBottom: 12 }}>Delete specific data</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SECTIONS.map(s => (
            <DangerCard key={s.type} {...s} onDeleted={handleDeleted} />
          ))}
        </div>
      </div>

      {/* Full reset */}
      <div style={{ padding: 20, borderRadius: 12, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <RotateCcw size={16} color="#f87171" />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171" }}>Full application reset</div>
        </div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 14, lineHeight: 1.65 }}>
          This will permanently delete <strong style={{ color: T2 }}>all invoices, quotations, expenses, projects, customers, and services</strong>, reset document counters, and restore company settings to defaults. This action cannot be undone.
        </div>
        <Button variant="destructive" onClick={() => setResetOpen(true)}>
          <AlertTriangle size={13} className="mr-2" />Reset application
        </Button>
      </div>

      {/* Delete account (placeholder) */}
      <div style={{ padding: 16, borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T1, marginBottom: 4 }}>Delete account</div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>Permanently delete your account and all associated data. Contact support to proceed.</div>
        <Button variant="destructive" size="sm" disabled>Delete account</Button>
      </div>

      {/* Full reset dialog */}
      <Dialog open={resetOpen} onOpenChange={v => { setResetOpen(v); if (!v) setResetConfirm(""); }}>
        <DialogContent style={{ maxWidth: 440 }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#f87171" }}>Full application reset</DialogTitle>
            <DialogDescription>
              This will delete all records and reset settings to defaults. This action is <strong>permanent and irreversible</strong>.
            </DialogDescription>
          </DialogHeader>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: T3, marginBottom: 8 }}>
              Type <code style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", padding: "1px 6px", borderRadius: 4 }}>RESET</code> to confirm.
            </div>
            <Input
              value={resetConfirm}
              onChange={e => setResetConfirm(e.target.value.toUpperCase())}
              placeholder="RESET"
              style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => { setResetOpen(false); setResetConfirm(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              loading={resetting}
              disabled={resetConfirm !== "RESET"}
              onClick={doFullReset}
            >
              Reset everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
