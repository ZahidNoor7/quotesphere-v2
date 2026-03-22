"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/shared/status-badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, GLASS_INPUT, GLASS_SELECT, ICON_PILL, FIELD_INPUT, CARD } from "@/lib/ds";
import type { Project, Customer } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const cfetch = (url: string) => fetch(url).then(r => r.json()).then(d => d.data || d);

const STATUS_COLORS: Record<string, string> = {
  in_progress: "#6366f1", pending: "#fbbf24", on_hold: "#f87171", complete: "#34d399", cancelled: "rgba(160,170,255,0.42)",
};

function ProjectForm({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const { data: custs = [] } = useSWR<Customer[]>("/api/customers?limit=200", cfetch);
  const [form, setForm] = useState({ name: "", customer_id: "", status: "pending", budget: "", start_date: "", due_date: "", description: "" });
  const [loading, setLoading] = useState(false);
  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  async function save() {
    if (!form.name || !form.customer_id) { toast.error("Name and client required."); return; }
    setLoading(true);
    try {
      const cust = (custs as Customer[]).find(c => c._id === form.customer_id);
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, budget: parseFloat(form.budget) || 0, customer_name: cust?.name ?? "", customer_phone: cust?.phone_no ?? "" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Project created."); onSave();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
        <div><label style={lbl}>Project name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Office renovation Phase 1" style={FIELD_INPUT} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Client *</label>
            <select value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
              <option value="">Select client</option>
              {(custs as Customer[]).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...FIELD_INPUT, cursor: "pointer" }}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="complete">Complete</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>Start date</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={FIELD_INPUT} /></div>
          <div><label style={lbl}>Due date</label><input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={FIELD_INPUT} /></div>
        </div>
        <div><label style={lbl}>Budget (PKR)</label><input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="0" style={FIELD_INPUT} /></div>
        <div><label style={lbl}>Description</label><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief project description" style={FIELD_INPUT} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={save}>Create project</Button>
      </div>
    </>
  );
}

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "12" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const { data, mutate, isLoading } = useSWR(`/api/projects?${params}`, fetcher, { keepPreviousData: true });
  const projects: Project[] = data?.data ?? [];
  const pagination = data?.pagination;

  async function del(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    toast.success("Deleted."); mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Projects</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={GLASS_SELECT}>
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="on_hold">On hold</option>
            <option value="complete">Complete</option>
          </select>
          <Button onClick={() => setShowForm(true)} size="sm">+ New project</Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 7 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search projects..." style={{ ...GLASS_INPUT, flex: 1, minWidth: 140 }} />
        </div>

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : projects.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ fontSize: 13, color: T2 }}>No projects yet</div>
            <Button onClick={() => setShowForm(true)} size="sm">+ Create first project</Button>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(p => (
              <div key={p._id} className="glass-card" style={{ padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", position: "relative" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "none"}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{p.customer_name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <ProjectStatusBadge status={p.status} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button style={{ ...ICON_PILL, width: 22, height: 22 }}
                          onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" })}
                          onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: GLASS, color: T2, borderColor: GLASS_BORDER })}
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(p._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: T3 }}>
                  {p.due_date && <span>Due {formatDate(p.due_date)}</span>}
                  {p.budget > 0 && <span>Budget {formatCurrency(p.budget, p.currency)}</span>}
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: STATUS_COLORS[p.status] || "#6366f1", borderRadius: 4, width: p.status === "complete" ? "100%" : p.status === "in_progress" ? "55%" : p.status === "on_hold" ? "35%" : "10%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T3 }}>{(page-1)*pagination.limit+1}–{Math.min(page*pagination.limit,pagination.total)} of {pagination.total}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</Button>
              <Button variant="outline" size="sm" disabled={page>=pagination.pages} onClick={()=>setPage(p=>p+1)}>Next →</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent><DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <ProjectForm onSave={() => { setShowForm(false); mutate(); }} onClose={() => setShowForm(false)} /></DialogContent>
      </Dialog>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
