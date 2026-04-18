"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceStatusBadge, PaymentStatusBadge, QuotationStatusBadge, ExpenseStatusBadge } from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils";
import { T1, T2, T3, GLASS, GLASS_BORDER, TOPBAR_STYLE, CARD, TABLE_STYLE, TH_STYLE, TD_STYLE, TABLE_WRAP, ICON_PILL, FIELD_INPUT, GLASS_INPUT } from "@/lib/ds";
import type { Project, Invoice, Quotation, Expense, Customer, ProjectStatus } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);
const cfetch = (url: string) => fetch(url).then(r => r.json()).then(d => d.data || d);

const STATUS_COLORS: Record<string, string> = {
  in_progress: "#6366f1", pending: "#fbbf24", on_hold: "#f87171", complete: "#34d399", cancelled: "rgba(160,170,255,0.42)",
};

function InlineStatusSelect({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const color = STATUS_COLORS[project.status] || "#6366f1";
  return (
    <select
      aria-label="Change project status"
      value={project.status}
      disabled={saving}
      onChange={async (e) => {
        const newStatus = e.target.value;
        setSaving(true);
        try {
          await fetch(`/api/projects/${project._id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          });
          onUpdate();
        } finally { setSaving(false); }
      }}
      style={{ fontSize: 11, fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", outline: "none", opacity: saving ? 0.6 : 1 }}
    >
      <option value="pending">Pending</option>
      <option value="in_progress">In Progress</option>
      <option value="on_hold">On Hold</option>
      <option value="complete">Complete</option>
      <option value="cancelled">Cancelled</option>
    </select>
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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const { data, isLoading, mutate } = useSWR(`/api/projects/${id}`, fetcher);

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
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4"/></svg>
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
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5a2.12 2.12 0 013 3L5 15H1v-4L11.5 2.5z"/></svg>
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
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
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

            {/* Financial stats card */}
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
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="invoices">
            <TabsList
              className="h-auto gap-1 rounded-full p-1"
              style={{ background: GLASS, border: `0.5px solid ${GLASS_BORDER}` }}
            >
              {([
                { key: "invoices", label: "Invoices", count: stats.invoiceCount },
                { key: "quotations", label: "Quotations", count: stats.quotationCount },
                { key: "expenses", label: "Expenses", count: stats.expenseCount },
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
          </Tabs>
        </div>

        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
            {showEdit && <ProjectEditForm initial={project} onSave={() => { setShowEdit(false); mutate(); }} onClose={() => setShowEdit(false)} />}
          </DialogContent>
        </Dialog>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </TooltipProvider>
  );
}
