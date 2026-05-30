"use client";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePickerInput } from "@/components/ui/date-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, GLASS, GLASS_BORDER, TOPBAR_STYLE, GLASS_INPUT, ICON_PILL, FIELD_INPUT } from "@/lib/ds";
import type { Project, Customer, ProjectStatus } from "@/types";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { FolderOpen } from "lucide-react";
import { SpinnerCenter } from "@/components/loaders";

const fetcher = (url: string) => fetch(url).then(r => r.json());
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
        onClick={e => e.stopPropagation()}
        className="w-auto"
        style={{ fontSize: 10, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 5, padding: "2px 8px 2px 5px", height: "auto", minHeight: "unset", opacity: saving ? 0.6 : 1, flexShrink: 0 }}
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

function ProjectForm({ onSave, onClose, initial }: { onSave: () => void; onClose: () => void; initial?: Project }) {
  const { data: custs = [] } = useSWR<Customer[]>("/api/customers?limit=200", cfetch);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    customer_id: initial?.customer_id ?? "",
    status: initial?.status ?? "pending",
    budget: initial?.budget ? String(initial.budget) : "",
    start_date: initial?.start_date ? initial.start_date.split("T")[0] : "",
    due_date: initial?.due_date ? initial.due_date.split("T")[0] : "",
    description: initial?.description ?? "",
    notes: initial?.notes ?? "",
    tags: initial?.tags ? initial.tags.join(", ") : "",
    progress: String(initial?.progress ?? 0),
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!form.name || !form.customer_id) { toast.error("Name and client required."); return; }
    setLoading(true);
    try {
      const cust = (custs as Customer[]).find(c => c._id === form.customer_id);
      const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const payload = {
        ...form, budget: parseFloat(form.budget) || 0, progress: parseInt(form.progress) || 0, tags,
        customer_name: cust?.name ?? initial?.customer_name ?? "",
        customer_phone: cust?.phone_no ?? initial?.customer_phone ?? "",
      };
      const res = await fetch(initial ? `/api/projects/${initial._id}` : "/api/projects", {
        method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(initial ? "Project updated." : "Project created."); onSave();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  const lbl = "text-[11px] font-medium mb-1 block";

  return (
    <>
      <div className="flex flex-col gap-3 pt-1.5 pb-1 max-h-[70vh] overflow-y-auto no-scrollbar px-0.5 -mx-0.5">
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
            <DatePickerInput value={form.start_date} onChange={v => setForm(p => ({ ...p, start_date: v }))} placeholder="Pick start date" className="bg-(--glass) border-(--glass-border) text-(--t1) focus-visible:ring-indigo-500/30" />
          </div>
          <div className="space-y-1">
            <Label className={lbl} style={{ color: T3 }}>Due date</Label>
            <DatePickerInput value={form.due_date} onChange={v => setForm(p => ({ ...p, due_date: v }))} placeholder="Pick due date" className="bg-(--glass) border-(--glass-border) text-(--t1) focus-visible:ring-indigo-500/30" />
          </div>
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
        <Button loading={loading} onClick={save}>{initial ? "Save changes" : "Create project"}</Button>
      </div>
    </>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [formTarget, setFormTarget] = useState<null | "new" | Project>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("in_progress");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "12", sort, order });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (customerId) params.set("customer_id", customerId);

  const { data, mutate, isLoading, error } = useSWR(`/api/projects?${params}`, fetcher, { keepPreviousData: true });
  const { data: statsData } = useSWR("/api/projects/stats", (url) => fetch(url).then(r => r.json()).then(d => d.data));
  const { data: customerList = [] } = useSWR<Customer[]>("/api/customers?limit=200", cfetch);

  const projects: Project[] = data?.data ?? [];
  const pagination = data?.pagination;
  const stats = statsData ?? { total: 0, in_progress: 0, overdue: 0, total_budget: 0 };
  const editProject: Project | undefined = formTarget !== null && formTarget !== "new" ? formTarget : undefined;

  async function del(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    toast.success("Deleted."); mutate();
  }

  async function duplicate(p: Project, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Copy of ${p.name}`, customer_id: p.customer_id, customer_name: p.customer_name, customer_phone: p.customer_phone, status: "pending", budget: p.budget, currency: p.currency, description: p.description, tags: p.tags, notes: p.notes }),
    });
    const d = await res.json();
    if (!d.success) { toast.error("Failed to duplicate."); return; }
    toast.success("Project duplicated."); mutate();
  }

  async function exportCSV() {
    const res = await fetch("/api/projects?limit=9999");
    const d = await res.json();
    const rows: Project[] = d.data ?? [];
    const hdrs = ["project_no", "name", "customer_name", "status", "budget", "currency", "due_date", "progress"];
    const csv = [hdrs.join(","), ...rows.map(p => [p.project_no, `"${p.name.replace(/"/g, '""')}"`, `"${p.customer_name.replace(/"/g, '""')}"`, p.status, p.budget, p.currency, p.due_date ? p.due_date.split("T")[0] : "", p.progress ?? 0].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "projects.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function bulkChangeStatus() {
    await Promise.all(selected.map(id => fetch(`/api/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: bulkStatus }) })));
    toast.success(`${selected.length} projects updated.`); setSelected([]); mutate();
  }

  async function bulkDelete() {
    await Promise.all(selected.map(id => fetch(`/api/projects/${id}`, { method: "DELETE" })));
    toast.success(`${selected.length} projects deleted.`); setSelected([]); mutate();
  }

  const statChips = [
    { label: "Total", val: String(stats.total), color: "#818cf8" },
    { label: "In Progress", val: String(stats.in_progress), color: "#6366f1" },
    { label: "Overdue", val: String(stats.overdue), color: "#f87171" },
    { label: "Budget", val: formatCurrency(stats.total_budget, "PKR"), color: "#34d399" },
  ];

  return (
    <TooltipProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Topbar */}
        <div style={TOPBAR_STYLE}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Projects</div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {/* Status filter — hidden on mobile (appears in filter row) */}
            <div className="hidden sm:block">
              <Select value={status || "_all"} onValueChange={v => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
                <SelectTrigger style={{ ...GLASS_INPUT, height: 32, fontSize: 12 }} className="w-[130px] rounded-full focus-visible:ring-indigo-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Export CSV" onClick={exportCSV} style={{ ...ICON_PILL, width: 30, height: 30 }} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-full">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1v9M4 6l4 4 4-4M2 12h12v2H2z" /></svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
            <Button onClick={() => setFormTarget("new")} size="sm">+ New project</Button>
          </div>
        </div>

        <div style={{ padding: "14px 16px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }} className="sm:px-5 sm:py-[18px]">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {statChips.map(c => (
              <div key={c.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 10px", background: GLASS, borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}` }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: c.color }} className="tabular-nums">{c.val}</span>
                <span style={{ fontSize: 10, color: T3, marginTop: 1 }}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Filter + Sort row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search projects…"
              style={{ ...GLASS_INPUT, height: 32 }}
              className="flex-1 min-w-0 focus-visible:ring-indigo-500/30 sm:min-w-[140px]"
              aria-label="Search projects"
            />
            {/* Status filter — mobile only */}
            <div className="sm:hidden">
              <Select value={status || "_all"} onValueChange={v => { setStatus(v === "_all" ? "" : v); setPage(1); }}>
                <SelectTrigger style={{ ...GLASS_INPUT, height: 32, fontSize: 12 }} className="w-full rounded-full focus-visible:ring-indigo-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={customerId || "_all"} onValueChange={v => { setCustomerId(v === "_all" ? "" : v); setPage(1); }}>
                <SelectTrigger style={{ ...GLASS_INPUT, height: 32, fontSize: 12 }} className="w-[130px] rounded-full focus-visible:ring-indigo-500/30">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All clients</SelectItem>
                  {(customerList as Customer[]).map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger style={{ ...GLASS_INPUT, height: 32, fontSize: 12 }} className="w-[110px] rounded-full focus-visible:ring-indigo-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Newest</SelectItem>
                  <SelectItem value="due_date">Due date</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={order === "desc" ? "Sort descending" : "Sort ascending"}
                    onClick={() => setOrder(o => o === "desc" ? "asc" : "desc")}
                    style={{ ...ICON_PILL, width: 32, height: 32, flexShrink: 0 }}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-full"
                  >
                    {order === "desc"
                      ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M4 9l4 4 4-4" /></svg>
                      : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 13V3M4 7l4-4 4 4" /></svg>}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{order === "desc" ? "Descending" : "Ascending"}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div style={{ flex: 1 }}><SpinnerCenter /></div>
          ) : error ? (
            <div style={{ flex: 1 }}><ErrorState message="Failed to load projects." onRetry={() => mutate()} /></div>
          ) : projects.length === 0 ? (
            <div style={{ flex: 1 }}>
              <EmptyState
                icon={FolderOpen}
                title="No projects yet"
                description="Create your first project to start tracking work"
                action={<Button onClick={() => setFormTarget("new")} size="sm">+ Create project</Button>}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto" style={{ flex: 1, paddingBottom: selected.length > 0 ? 72 : 0, alignContent: "start" }}>
              {projects.map(p => {
                const isOverdue = p.due_date && new Date(p.due_date) < new Date() && p.status !== "complete" && p.status !== "cancelled";
                const isSelected = selected.includes(p._id);
                const progressWidth = (p.progress != null && p.progress > 0) ? `${p.progress}%` : p.status === "complete" ? "100%" : p.status === "in_progress" ? "55%" : p.status === "on_hold" ? "35%" : "10%";
                return (
                  <div
                    key={p._id}
                    className="glass-card focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open project ${p.name}`}
                    style={{ padding: "12px 14px", cursor: "pointer", transition: "transform 0.2s", position: "relative", outline: isSelected ? "1.5px solid rgba(99,102,241,0.5)" : undefined }}
                    onClick={() => router.push(`/projects/${p._id}`)}
                    onKeyDown={e => e.key === "Enter" && router.push(`/projects/${p._id}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "none"}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          aria-label={`Select ${p.name}`}
                          className="mt-0.5 shrink-0 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                          onCheckedChange={() => { }}
                          onClick={e => toggleSelect(p._id, e as unknown as React.MouseEvent)}
                        />
                        <div className="min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 500, color: T1 }} className="truncate">{p.name}</div>
                          <div style={{ fontSize: 11, color: T3, marginTop: 2 }} className="truncate">{p.customer_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <InlineStatusSelect project={p} onUpdate={mutate} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label="Edit project"
                              onClick={e => { e.stopPropagation(); setFormTarget(p); }}
                              style={{ ...ICON_PILL, width: 22, height: 22 }}
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-full"
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5a2.12 2.12 0 013 3L5 15H1v-4L11.5 2.5z" /></svg>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label="Duplicate project"
                              onClick={e => duplicate(p, e)}
                              style={{ ...ICON_PILL, width: 22, height: 22 }}
                              className="hidden sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-full"
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M3 10V3h7" /></svg>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicate</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              aria-label="Delete project"
                              onClick={e => e.stopPropagation()}
                              style={{ ...ICON_PILL, width: 22, height: 22 }}
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 rounded-full hover:bg-red-500/10! hover:text-red-400! hover:border-red-400/30! transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(p._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-2" style={{ fontSize: 11, color: T3 }}>
                      {p.due_date && <span>Due {formatDate(p.due_date)}</span>}
                      {isOverdue && <span style={{ fontSize: 10, fontWeight: 600, color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 4, padding: "1px 6px" }}>Overdue</span>}
                      {p.budget > 0 && <span className="tabular-nums">Budget {formatCurrency(p.budget, p.currency)}</span>}
                    </div>
                    {p.tags && p.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {p.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, fontWeight: 500, padding: "1px 7px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ height: 3, background: "var(--glass)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: STATUS_COLORS[p.status] || "#6366f1", borderRadius: 4, width: progressWidth, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 12, color: T3 }} className="tabular-nums">{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</Button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.length > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 flex-wrap justify-center px-4 py-2.5 rounded-xl shadow-2xl max-w-[calc(100dvw-2rem)]"
            style={{ background: "rgba(15,15,30,0.92)", backdropFilter: "blur(20px)", border: `0.5px solid ${GLASS_BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#818cf8" }}>{selected.length} selected</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger style={{ ...GLASS_INPUT, height: 32, fontSize: 11 }} className="w-[120px] rounded-full focus-visible:ring-indigo-500/30">
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
            <Button size="sm" onClick={bulkChangeStatus}>Apply</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-500/10">Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete {selected.length} projects?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={bulkDelete}>Delete all</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <button aria-label="Clear selection" onClick={() => setSelected([])} style={{ ...ICON_PILL, width: 24, height: 24 }} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-full">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
        )}

        <Dialog open={formTarget !== null} onOpenChange={open => !open && setFormTarget(null)}>
          <DialogContent className="max-w-lg w-[calc(100dvw-2rem)] sm:w-full">
            <DialogHeader><DialogTitle>{editProject ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
            <ProjectForm
              initial={editProject}
              onSave={() => { setFormTarget(null); mutate(); }}
              onClose={() => setFormTarget(null)}
            />
          </DialogContent>
        </Dialog>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      </div>
    </TooltipProvider>
  );
}
