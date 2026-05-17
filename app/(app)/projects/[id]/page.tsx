"use client";
import { useState, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceStatusBadge, PaymentStatusBadge, QuotationStatusBadge, ExpenseStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD, TABLE_STYLE, TH_STYLE, TD_STYLE, TABLE_WRAP, ICON_PILL, FIELD_INPUT, GLASS_INPUT } from "@/lib/ds";
import type { Project, Invoice, Quotation, Expense, Customer, ProjectStatus, ProjectNote, ProjectAttachment, ProjectMilestone } from "@/types";
import { StickyNote, Paperclip, Plus, Trash2, Upload, FileText, Image as ImageIcon, Film, Clock } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);
const cfetch = (url: string) => fetch(url).then(r => r.json()).then(d => d.data || d);

const STATUS_COLORS: Record<string, string> = {
  in_progress: "#6366f1", pending: "#fbbf24", on_hold: "#f87171", complete: "#34d399", cancelled: "rgba(160,170,255,0.42)",
};

function InlineStatusSelect({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const color = STATUS_COLORS[project.status] || "#6366f1";
  return (
    <Select
      value={project.status}
      disabled={saving}
      onValueChange={async (newStatus) => {
        setSaving(true);
        try {
          await fetch(`/api/projects/${project._id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
          onUpdate();
        } finally { setSaving(false); }
      }}
    >
      <SelectTrigger
        className="w-auto"
        style={{ fontSize: 11, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 6, padding: "3px 10px 3px 8px", height: "auto", minHeight: "unset", opacity: saving ? 0.6 : 1 }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ProjectEditForm({ initial, onSave, onClose }: { initial: Project; onSave: () => void; onClose: () => void }) {
  const { data: custs = [] } = useSWR<Customer[]>("/api/customers?limit=200", cfetch);
  const [form, setForm] = useState({
    name: initial.name,
    customer_id: initial.customer_id,
    status: initial.status as string,
    budget: initial.budget ? String(initial.budget) : "",
    start_date: initial.start_date ? initial.start_date.split("T")[0] : "",
    due_date: initial.due_date ? initial.due_date.split("T")[0] : "",
    expected_end_date: initial.expected_end_date ? initial.expected_end_date.split("T")[0] : "",
    description: initial.description ?? "",
    notes: initial.notes ?? "",
    tags: initial.tags ? initial.tags.join(", ") : "",
    progress: String(initial.progress ?? 0),
  });
  const [loading, setLoading] = useState(false);
  const lbl = "text-[11px] font-medium mb-1 block";

  async function save() {
    if (!form.name || !form.customer_id) { toast.error("Name and client required."); return; }
    setLoading(true);
    try {
      const cust = (custs as Customer[]).find(c => c._id === form.customer_id);
      const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const res = await fetch(`/api/projects/${initial._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, budget: parseFloat(form.budget) || 0, progress: parseInt(form.progress) || 0, tags,
          customer_name: cust?.name ?? initial.customer_name,
          customer_phone: cust?.phone_no ?? initial.customer_phone,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Project updated."); onSave();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="flex flex-col gap-3 pt-1.5 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label htmlFor="proj-name" className={lbl} style={{ color: T3 }}>Project name *</Label>
          <Input id="proj-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Office renovation Phase 1" style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Client *</Label>
            <Select value={form.customer_id || "_none"} onValueChange={v => setForm(p => ({ ...p, customer_id: v === "_none" ? "" : v }))}>
              <SelectTrigger style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30 w-full">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Select client</SelectItem>
                {(custs as Customer[]).map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as ProjectStatus }))}>
              <SelectTrigger style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Start date</Label>
            <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
          </div>
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Due date</Label>
            <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className={lbl} style={{ color: T3 }}>Expected completion date</Label>
          <Input type="date" value={form.expected_end_date} onChange={e => setForm(p => ({ ...p, expected_end_date: e.target.value }))} style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Budget</Label>
            <Input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="0" style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
          </div>
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Progress ({form.progress}%)</Label>
            <Slider min={0} max={100} step={1} value={[parseInt(form.progress) || 0]} onValueChange={([v]) => setForm(p => ({ ...p, progress: String(v) }))} className="mt-3" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className={lbl} style={{ color: T3 }}>Tags (comma-separated)</Label>
          <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="design, backend, phase-1" style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
        </div>
        <div className="space-y-1">
          <Label className={lbl} style={{ color: T3 }}>Description</Label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief project description" style={FIELD_INPUT} className="focus-visible:ring-indigo-500/30" />
        </div>
        <div className="space-y-1">
          <Label className={lbl} style={{ color: T3 }}>Notes</Label>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={3} style={{ ...FIELD_INPUT, resize: "vertical" }} className="focus-visible:ring-indigo-500/30" />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={save}>Save changes</Button>
      </div>
    </>
  );
}

// ─── Milestones Tab ───────────────────────────────────────────────────────────
function MilestonesTab({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const milestones: ProjectMilestone[] = project.milestones ?? [];
  const [form, setForm] = useState({ name: "", due_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const done  = milestones.filter(m => !!m.completed_at).length;
  const total = milestones.length;

  async function add() {
    if (!form.name.trim()) { toast.error("Milestone name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/milestones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, due_date: form.due_date || undefined, notes: form.notes || undefined }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setForm({ name: "", due_date: "", notes: "" });
      onUpdate();
      toast.success("Milestone added.");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function toggleComplete(m: ProjectMilestone) {
    setCompleting(m._id);
    try {
      const res = await fetch(`/api/projects/${project._id}/milestones/${m._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !m.completed_at }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      onUpdate();
    } catch (err: any) { toast.error(err.message); }
    finally { setCompleting(null); }
  }

  async function remove(milestoneId: string) {
    try {
      await fetch(`/api/projects/${project._id}/milestones/${milestoneId}`, { method: "DELETE" });
      onUpdate();
      toast.success("Milestone removed.");
    } catch { toast.error("Failed to remove."); }
  }

  const isOverdue = (m: ProjectMilestone) =>
    !m.completed_at && m.due_date && new Date(m.due_date) < new Date();

  return (
    <div>
      {/* Progress summary */}
      {total > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: T2 }}>{done} of {total} complete</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: done === total ? "#34d399" : T3 }}>
              {total > 0 ? Math.round((done / total) * 100) : 0}%
            </span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${total > 0 ? (done / total) * 100 : 0}%`, background: "linear-gradient(90deg,#6366f1,#34d399)", borderRadius: 10, transition: "width 0.4s" }} />
          </div>
        </div>
      )}

      {/* Add form */}
      <div style={{ ...CARD, padding: 14, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T1, marginBottom: 10 }}>Add milestone</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: T3, display: "block", marginBottom: 3 }}>Name *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Design approval" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T3, display: "block", marginBottom: 3 }}>Due date</label>
            <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
          </div>
          <Button onClick={add} loading={saving} style={{ marginTop: 18 }}>
            <Plus size={13} style={{ marginRight: 4 }} /> Add
          </Button>
        </div>
      </div>

      {/* Milestone list */}
      {milestones.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: T3, fontSize: 13 }}>
          No milestones yet. Add one above to track project phases.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...milestones].sort((a, b) => {
            if (!!a.completed_at !== !!b.completed_at) return a.completed_at ? 1 : -1;
            if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            return 0;
          }).map(m => {
            const completed  = !!m.completed_at;
            const overdue    = isOverdue(m);
            const isCompleting = completing === m._id;

            return (
              <div key={m._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: completed ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)", border: `0.5px solid ${completed ? "rgba(52,211,153,0.2)" : overdue ? "rgba(248,113,113,0.25)" : GLASS_BORDER}`, transition: "all 0.2s" }}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(m)}
                  disabled={isCompleting}
                  style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${completed ? "#34d399" : overdue ? "#f87171" : "rgba(255,255,255,0.2)"}`, background: completed ? "rgba(52,211,153,0.2)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                  title={completed ? "Mark incomplete" : "Mark complete"}
                >
                  {completed && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#34d399" strokeWidth="2"><path d="M2 6l3 3 5-5" /></svg>}
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: completed ? T3 : T1, textDecoration: completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {m.name}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" as const }}>
                    {m.due_date && (
                      <span style={{ fontSize: 10.5, color: overdue ? "#f87171" : completed ? T3 : T3 }}>
                        {overdue ? "⚠ " : ""}{completed ? "Due " : "Due "}{formatDate(m.due_date)}
                      </span>
                    )}
                    {m.completed_at && (
                      <span style={{ fontSize: 10.5, color: "#34d399" }}>
                        ✓ Completed {formatDate(m.completed_at)}
                      </span>
                    )}
                    {m.notes && (
                      <span style={{ fontSize: 10.5, color: T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 200 }}>
                        {m.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => remove(m._id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 4, flexShrink: 0, opacity: 0.6, transition: "opacity 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Time Tracking Tab ────────────────────────────────────────────────────────
function TimeTrackingTab({ projectId, currency }: { projectId: string; currency: string }) {
  const { data, mutate } = useSWR<any>(
    `/api/time-entries?project_id=${projectId}`,
    (url: string) => fetch(url).then(r => r.json())
  );
  const entries: any[] = data?.data ?? [];
  const summary = data?.summary ?? { totalHours: 0, totalAmount: 0 };

  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: "", description: "", hourly_rate: "" });
  const [saving, setSaving] = useState(false);

  async function addEntry() {
    if (!form.description.trim() || !form.hours) { toast.error("Description and hours are required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, date: form.date, hours: parseFloat(form.hours), description: form.description, hourly_rate: parseFloat(form.hourly_rate) || 0, currency }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setForm({ date: new Date().toISOString().slice(0, 10), hours: "", description: "", hourly_rate: "" });
      mutate();
      toast.success("Time entry added.");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function deleteEntry(id: string) {
    try {
      await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
      mutate();
      toast.success("Entry deleted.");
    } catch { toast.error("Failed to delete."); }
  }

  async function toggleBilled(id: string, billed: boolean) {
    await fetch(`/api/time-entries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billed: !billed }) });
    mutate();
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ ...CARD, padding: "12px 16px", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: T3, marginBottom: 3 }}>TOTAL HOURS</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#818cf8", display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={16} color="#818cf8" /> {summary.totalHours.toFixed(1)}h
          </div>
        </div>
        <div style={{ ...CARD, padding: "12px 16px", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: T3, marginBottom: 3 }}>BILLABLE AMOUNT</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#34d399" }}>{formatCurrency(summary.totalAmount, currency)}</div>
        </div>
      </div>

      {/* Add form */}
      <div style={{ ...CARD, padding: 14, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T1, marginBottom: 10 }}>Log time</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 130px auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 11, color: T3, display: "block", marginBottom: 3 }}>Description *</label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What did you work on?" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T3, display: "block", marginBottom: 3 }}>Hours *</label>
            <Input type="number" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} placeholder="1.5" min="0.01" step="0.25" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T3, display: "block", marginBottom: 3 }}>Rate / hr</label>
            <Input type="number" value={form.hourly_rate} onChange={e => setForm(p => ({ ...p, hourly_rate: e.target.value }))} placeholder="0" min="0" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: T3, display: "block", marginBottom: 3 }}>Date</label>
            <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <Button onClick={addEntry} loading={saving} style={{ marginTop: 18 }}>
            <Plus size={14} style={{ marginRight: 4 }} /> Add
          </Button>
        </div>
      </div>

      {/* Entries table */}
      {entries.length > 0 ? (
        <div style={TABLE_WRAP}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                {["Date", "Description", "Hours", "Rate", "Amount", "Billed", ""].map(h => (
                  <th key={h} style={TH_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e._id} className="table-row-hover">
                  <td style={{ ...TD_STYLE, color: T3, whiteSpace: "nowrap" as const }}>{formatDate(e.date)}</td>
                  <td style={{ ...TD_STYLE, color: T1 }}>{e.description}</td>
                  <td style={{ ...TD_STYLE, color: "#818cf8", fontWeight: 600 }}>{e.hours}h</td>
                  <td style={{ ...TD_STYLE, color: T2 }}>{e.hourly_rate > 0 ? formatCurrency(e.hourly_rate, e.currency) : "—"}</td>
                  <td style={{ ...TD_STYLE, color: "#34d399", fontWeight: 500 }}>
                    {e.hourly_rate > 0 ? formatCurrency(e.hours * e.hourly_rate, e.currency) : "—"}
                  </td>
                  <td style={TD_STYLE}>
                    <button
                      onClick={() => toggleBilled(e._id, e.billed)}
                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, border: "none", cursor: "pointer", fontWeight: 600,
                        background: e.billed ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
                        color: e.billed ? "#34d399" : T3 }}
                    >
                      {e.billed ? "Billed" : "Unbilled"}
                    </button>
                  </td>
                  <td style={TD_STYLE}>
                    <button onClick={() => deleteEntry(e._id)} style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 0", color: T3, fontSize: 13 }}>
          No time entries yet. Log your first entry above.
        </div>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, mutate } = useSWR(`/api/projects/${id}`, fetcher);

  async function addNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/projects/${id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setNewNote("");
      mutate();
      toast.success("Note added.");
    } catch (err: any) { toast.error(err.message); }
    finally { setAddingNote(false); }
  }

  async function deleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    try {
      const res = await fetch(`/api/projects/${id}/notes`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      mutate();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeletingNoteId(null); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_MB = 25;
    const BLOCKED_EXTS = [".exe", ".bat", ".sh", ".cmd", ".msi", ".dmg", ".app"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (BLOCKED_EXTS.includes(ext)) {
      toast.error(`File type "${ext}" is not allowed.`);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${MAX_MB} MB.`);
      e.target.value = "";
      return;
    }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "quotesphere/attachments");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);
      const res = await fetch(`/api/projects/${id}/attachments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: uploadData.data.url, name: file.name, type: file.type, size: file.size }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      mutate();
      toast.success("File attached.");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingFile(false); e.target.value = ""; }
  }

  async function deleteAttachment(attId: string) {
    setDeletingAttId(attId);
    try {
      const res = await fetch(`/api/projects/${id}/attachments`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId: attId }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      mutate();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeletingAttId(null); }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function AttachIcon({ type }: { type: string }) {
    if (type.startsWith("image/")) return <ImageIcon size={14} />;
    if (type.startsWith("video/")) return <Film size={14} />;
    return <FileText size={14} />;
  }

  async function deleteProject() {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    toast.success("Project deleted.");
    router.push("/projects");
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-[300px]">
      <div style={{ width: 28, height: 28, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!data) return <div className="p-6" style={{ color: T3 }}>Project not found.</div>;

  const { project, invoices, quotations, expenses, stats } = data as {
    project: Project; invoices: Invoice[]; quotations: Quotation[]; expenses: Expense[];
    stats: { totalInvoiced: number; totalPaid: number; totalOutstanding: number; totalExpenses: number; invoiceCount: number; quotationCount: number; expenseCount: number; };
  };

  const progressPct = typeof project.progress === "number" ? project.progress : 0;
  const progressColor = STATUS_COLORS[project.status] || "#6366f1";
  const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== "complete" && project.status !== "cancelled";
  const balance = project.budget - stats.totalExpenses;

  return (
    <TooltipProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Topbar */}
        <div style={TOPBAR_STYLE} className="flex-wrap gap-y-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/projects"
              aria-label="Back to projects"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, textDecoration: "none", flexShrink: 0 }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4" /></svg>
              <span className="hidden sm:inline">Projects</span>
            </Link>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }} className="truncate min-w-0">{project.name}</div>
            {isOverdue && (
              <span className="hidden sm:inline shrink-0" style={{ fontSize: 10, fontWeight: 600, color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 4, padding: "2px 7px" }}>Overdue</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Button asChild variant="outline" size="sm" className="hidden sm:flex">
              <Link href={`/quotations/new?project_id=${id}&customer_id=${project.customer_id}`}>+ Quotation</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/invoices/new?project_id=${id}&customer_id=${project.customer_id}`}>+ Invoice</Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label="Edit project"
                  onClick={() => setShowEdit(true)}
                  style={{ ...ICON_PILL, width: 30, height: 30 }}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-full"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5a2.12 2.12 0 013 3L5 15H1v-4L11.5 2.5z" /></svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit project</TooltipContent>
            </Tooltip>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  aria-label="Delete project"
                  style={{ ...ICON_PILL, width: 30, height: 30 }}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 rounded-full transition-colors hover:bg-red-500/10! hover:text-red-400! hover:border-red-400/30!"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteProject}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 sm:p-5">
          {/* Info + Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Project info card */}
            <div style={{ ...CARD, padding: 16 }} className="flex flex-col gap-3">
              <div>
                <div style={{ fontSize: 10, color: T3, fontWeight: 500, marginBottom: 2 }}>{project.project_no}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>{project.name}</div>
                <div style={{ fontSize: 12, color: T3, marginTop: 3 }}>{project.customer_name}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: 11, color: T3, flexShrink: 0 }}>Status</span>
                <InlineStatusSelect project={project} onUpdate={mutate} />
                {isOverdue && (
                  <span className="sm:hidden" style={{ fontSize: 10, fontWeight: 600, color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 4, padding: "2px 7px" }}>Overdue</span>
                )}
              </div>
              {(project.start_date || project.due_date) && (
                <div className="grid grid-cols-2 gap-2">
                  {project.start_date && (
                    <div>
                      <div style={{ fontSize: 10, color: T3, marginBottom: 2 }}>Start date</div>
                      <div style={{ fontSize: 12, color: T2 }}>{formatDate(project.start_date)}</div>
                    </div>
                  )}
                  {project.due_date && (
                    <div>
                      <div style={{ fontSize: 10, color: T3, marginBottom: 2 }}>Due date</div>
                      <div style={{ fontSize: 12, color: isOverdue ? "#f87171" : T2 }}>{formatDate(project.due_date)}</div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span style={{ fontSize: 11, color: T3 }}>Progress</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: progressColor }} className="tabular-nums">{progressPct}%</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: progressColor, borderRadius: 4, width: `${progressPct}%`, transition: "width 0.4s ease" }} />
                </div>
              </div>
              {project.tags && project.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {project.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 10, fontWeight: 500, padding: "1px 7px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>{tag}</span>
                  ))}
                </div>
              )}
              {project.description && (
                <div>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 3 }}>Description</div>
                  <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{project.description}</div>
                </div>
              )}
              {project.notes && (
                <div>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 3 }}>Notes</div>
                  <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{project.notes}</div>
                </div>
              )}
            </div>

            {/* Financial stats + P&L card */}
            <div style={{ ...CARD, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>Financial Summary</div>
              <div className="flex flex-col gap-1.5">
                {([
                  { dot: "#818cf8", label: "Budget", val: formatCurrency(project.budget, project.currency) },
                  { dot: "#34d399", label: "Total Invoiced", val: formatCurrency(stats.totalInvoiced, project.currency) },
                  { dot: "#34d399", label: "Total Paid", val: formatCurrency(stats.totalPaid, project.currency) },
                  { dot: "#f87171", label: "Outstanding", val: formatCurrency(stats.totalOutstanding, project.currency) },
                  { dot: "#fbbf24", label: "Total Expenses", val: formatCurrency(stats.totalExpenses, project.currency) },
                  { dot: balance >= 0 ? "#34d399" : "#f87171", label: "Budget Remaining", val: formatCurrency(balance, project.currency) },
                ] as { dot: string; label: string; val: string }[]).map(({ dot, label, val }) => (
                  <div key={label} className="flex justify-between items-center" style={{ padding: "7px 10px", background: GLASS, borderRadius: 8, border: `0.5px solid ${GLASS_BORDER}` }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T3 }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T1 }} className="tabular-nums">{val}</span>
                  </div>
                ))}
              </div>
              {/* Profit & Loss */}
              {(() => {
                const grossProfit = stats.totalInvoiced - stats.totalExpenses;
                const margin = stats.totalInvoiced > 0 ? (grossProfit / stats.totalInvoiced) * 100 : 0;
                const profitable = grossProfit >= 0;
                return (
                  <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: profitable ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: `0.5px solid ${profitable ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T3, marginBottom: 6 }}>Profit & Loss</div>
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize: 11, color: T3 }}>Gross profit</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: profitable ? "#34d399" : "#f87171" }} className="tabular-nums">{formatCurrency(grossProfit, project.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span style={{ fontSize: 11, color: T3 }}>Margin</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: profitable ? "#34d399" : "#f87171" }}>{margin.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="invoices">
            <TabsList
              className="h-auto gap-1 rounded-full p-1 flex-wrap"
              style={{ background: GLASS, border: `0.5px solid ${GLASS_BORDER}` }}
            >
              {([
                { key: "invoices", label: "Invoices", count: stats.invoiceCount },
                { key: "quotations", label: "Quotations", count: stats.quotationCount },
                { key: "expenses", label: "Expenses", count: stats.expenseCount },
                { key: "milestones", label: "Milestones", count: project.milestones?.length ?? 0 },
                { key: "time", label: "Time", count: 0 },
                { key: "notes", label: "Notes", count: project.project_notes?.length ?? 0 },
                { key: "attachments", label: "Files", count: project.attachments?.length ?? 0 },
              ] as { key: string; label: string; count: number }[]).map(t => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="rounded-full text-[12px] font-medium px-3 py-1.5 data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-400 data-[state=inactive]:text-[--t3] data-[state=active]:shadow-none focus-visible:ring-indigo-500/40"
                  style={{ color: T3 }}
                >
                  {t.label}
                  {t.count > 0 && <span className="ml-1.5 opacity-60 text-[10px]">({t.count})</span>}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="invoices" className="mt-3">
              {invoices.length === 0 ? (
                <div className="text-center py-8" style={{ color: T3, fontSize: 13 }}>No invoices linked to this project.</div>
              ) : (
                <div style={TABLE_WRAP} className="overflow-x-auto">
                  <table style={TABLE_STYLE}>
                    <thead><tr>
                      <th style={TH_STYLE}>Invoice #</th>
                      <th style={TH_STYLE}>Date</th>
                      <th style={TH_STYLE}>Amount</th>
                      <th style={TH_STYLE}>Status</th>
                      <th style={TH_STYLE}>Payment</th>
                    </tr></thead>
                    <tbody>{invoices.map((inv: Invoice) => (
                      <tr key={inv._id}>
                        <td style={TD_STYLE}><Link href={`/invoices/${inv._id}`} style={{ color: "#818cf8", textDecoration: "none" }}>{inv.invoice_no}</Link></td>
                        <td style={TD_STYLE}>{formatDate(inv.issue_date)}</td>
                        <td style={TD_STYLE} className="tabular-nums">{formatCurrency(inv.total_amount, inv.currency)}</td>
                        <td style={TD_STYLE}><InvoiceStatusBadge status={inv.status} /></td>
                        <td style={TD_STYLE}><PaymentStatusBadge status={inv.payment_status} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="quotations" className="mt-3">
              {quotations.length === 0 ? (
                <div className="text-center py-8" style={{ color: T3, fontSize: 13 }}>No quotations linked to this project.</div>
              ) : (
                <div style={TABLE_WRAP} className="overflow-x-auto">
                  <table style={TABLE_STYLE}>
                    <thead><tr>
                      <th style={TH_STYLE}>Quotation #</th>
                      <th style={TH_STYLE}>Date</th>
                      <th style={TH_STYLE}>Amount</th>
                      <th style={TH_STYLE}>Status</th>
                    </tr></thead>
                    <tbody>{quotations.map((q: Quotation) => (
                      <tr key={q._id}>
                        <td style={TD_STYLE}><Link href={`/quotations/${q._id}`} style={{ color: "#818cf8", textDecoration: "none" }}>{q.quotation_no}</Link></td>
                        <td style={TD_STYLE}>{formatDate(q.issue_date)}</td>
                        <td style={TD_STYLE} className="tabular-nums">{formatCurrency(q.total_amount, q.currency)}</td>
                        <td style={TD_STYLE}><QuotationStatusBadge status={q.status} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="expenses" className="mt-3">
              {expenses.length === 0 ? (
                <div className="text-center py-8" style={{ color: T3, fontSize: 13 }}>No expenses linked to this project.</div>
              ) : (
                <div style={TABLE_WRAP} className="overflow-x-auto">
                  <table style={TABLE_STYLE}>
                    <thead><tr>
                      <th style={TH_STYLE}>Expense #</th>
                      <th style={TH_STYLE}>Date</th>
                      <th style={TH_STYLE}>Vendor</th>
                      <th style={TH_STYLE}>Amount</th>
                      <th style={TH_STYLE}>Status</th>
                    </tr></thead>
                    <tbody>{expenses.map((exp: Expense) => (
                      <tr key={exp._id}>
                        <td style={TD_STYLE}>{exp.expense_no}</td>
                        <td style={TD_STYLE}>{formatDate(exp.bill_date)}</td>
                        <td style={TD_STYLE} className="truncate max-w-[120px]">{exp.vendor_name || "—"}</td>
                        <td style={TD_STYLE} className="tabular-nums">{formatCurrency(exp.total_amount, exp.currency)}</td>
                        <td style={TD_STYLE}><ExpenseStatusBadge status={exp.status} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Notes ── */}
            <TabsContent value="notes" className="mt-3">
              <div className="flex flex-col gap-3">
                {/* Add note */}
                <div style={{ ...CARD, padding: 12 }}>
                  <Textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Write a note about this project…"
                    rows={3}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <Button size="sm" loading={addingNote} onClick={addNote} disabled={!newNote.trim()}>
                      <Plus size={12} className="mr-1.5" />Add note
                    </Button>
                  </div>
                </div>
                {/* Note list */}
                {(project.project_notes ?? []).length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center gap-2" style={{ color: T3 }}>
                    <StickyNote size={28} opacity={0.3} />
                    <span style={{ fontSize: 13 }}>No notes yet. Add the first one above.</span>
                  </div>
                ) : (
                  [...(project.project_notes ?? [])].reverse().map((note: ProjectNote) => (
                    <div key={note._id} style={{ ...CARD, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ fontSize: 12, color: T2, lineHeight: 1.65, flex: 1, whiteSpace: "pre-wrap" }}>{note.content}</div>
                        <button
                          onClick={() => deleteNote(note._id)}
                          disabled={deletingNoteId === note._id}
                          style={{ ...ICON_PILL, width: 24, height: 24, flexShrink: 0, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "0.5px solid rgba(248,113,113,0.2)" }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: T3, marginTop: 6 }}>
                        {new Date(note.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* ── Attachments ── */}
            <TabsContent value="attachments" className="mt-3">
              <input ref={attachFileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" style={{ display: "none" }} onChange={handleFileUpload} />
              <div className="flex flex-col gap-3">
                <Button variant="secondary" loading={uploadingFile} onClick={() => attachFileRef.current?.click()} className="self-start">
                  <Upload size={13} className="mr-1.5" />Upload file
                </Button>
                {(project.attachments ?? []).length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center gap-2" style={{ color: T3 }}>
                    <Paperclip size={28} opacity={0.3} />
                    <span style={{ fontSize: 13 }}>No files attached. Upload images, documents, or any file.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(project.attachments ?? []).map((att: ProjectAttachment) => (
                      <div key={att._id} style={{ ...CARD, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 7, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T3 }}>
                          <AttachIcon type={att.type} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 500, color: "#818cf8", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</a>
                          <div style={{ fontSize: 10, color: T3, marginTop: 1 }}>
                            {formatFileSize(att.size)} · {new Date(att.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteAttachment(att._id)}
                          disabled={deletingAttId === att._id}
                          style={{ ...ICON_PILL, width: 24, height: 24, flexShrink: 0, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "0.5px solid rgba(248,113,113,0.2)" }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="milestones" className="mt-3">
              <MilestonesTab project={project} onUpdate={mutate} />
            </TabsContent>

            <TabsContent value="time" className="mt-3">
              <TimeTrackingTab projectId={project._id} currency={project.currency ?? "PKR"} />
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-lg w-[calc(100dvw-2rem)] sm:w-full">
            <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
            {showEdit && <ProjectEditForm initial={project} onSave={() => { setShowEdit(false); mutate(); }} onClose={() => setShowEdit(false)} />}
          </DialogContent>
        </Dialog>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </TooltipProvider>
  );
}
