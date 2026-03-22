"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE, GLASS_INPUT, ICON_PILL, FIELD_INPUT, CARD } from "@/lib/ds";
import type { Service } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);
const CATEGORIES = ["General", "Consultation", "Installation", "Repair", "Cleaning", "Inspection", "Design", "Delivery", "Other"];
const UNITS = ["job", "hr", "day", "item", "sq ft", "m²", "kg", "piece"];

function ServiceForm({ initial, onSave, onClose }: { initial?: Service; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? "", category: initial?.category ?? "General", description: initial?.description ?? "", default_price: initial?.default_price?.toString() ?? "", unit: initial?.unit ?? "job" });
  const [loading, setLoading] = useState(false);
  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;

  async function save() {
    if (!form.name) { toast.error("Service name required."); return; }
    setLoading(true);
    try {
      const res = await fetch(initial ? `/api/services/${initial._id}` : "/api/services", {
        method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, default_price: parseFloat(form.default_price) || 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(initial ? "Updated." : "Service added."); onSave();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
        <div><label style={lbl}>Service name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Site visit & assessment" style={FIELD_INPUT} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>Category</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...FIELD_INPUT, cursor: "pointer" }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>Unit</label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={{ ...FIELD_INPUT, cursor: "pointer" }}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
        </div>
        <div><label style={lbl}>Default price (PKR)</label><input type="number" value={form.default_price} onChange={e => setForm(p => ({ ...p, default_price: e.target.value }))} placeholder="0" style={FIELD_INPUT} /></div>
        <div><label style={lbl}>Description</label><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description" style={FIELD_INPUT} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={save}>{initial ? "Save changes" : "Add service"}</Button>
      </div>
    </>
  );
}

export default function ServicesPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const { data: services = [], mutate, isLoading } = useSWR<Service[]>(`/api/services?${search ? `search=${search}` : ""}`, fetcher);

  async function del(id: string) {
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    toast.success("Deleted."); mutate();
  }

  const grouped = (services as Service[]).reduce((acc: Record<string, Service[]>, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s); return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Services catalog</div>
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={() => { setEditSvc(null); setShowForm(true); }} size="sm">+ Add service</Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." style={{ ...GLASS_INPUT, maxWidth: 320 }} />

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : (services as Service[]).length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ fontSize: 13, color: T2 }}>No services yet</div>
            <div style={{ fontSize: 12, color: T3 }}>Add predefined services for quick-add when creating invoices</div>
            <Button onClick={() => setShowForm(true)} size="sm" style={{ marginTop: 4 }}>+ Add first service</Button>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.entries(grouped).map(([cat, svcs]) => (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T3, marginBottom: 10 }}>{cat}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                  {svcs.map(s => (
                    <div key={s._id} className="glass-card" style={{ padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", position: "relative" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = GLASS_BORDER; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T1, flex: 1, marginRight: 8 }}>{s.name}</div>
                        <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 100, background: "rgba(99,102,241,0.12)", color: AC2, border: `0.5px solid rgba(99,102,241,0.22)`, flexShrink: 0 }}>{s.unit}</span>
                      </div>
                      {s.description && <div style={{ fontSize: 11, color: T3, marginBottom: 10, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.description}</div>}
                      <div style={{ fontSize: 16, fontWeight: 700, color: AC2 }}>{formatCurrency(s.default_price)}</div>
                      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }} className="svc-actions">
                        <button style={{ ...ICON_PILL, width: 22, height: 22 }} onClick={() => { setEditSvc(s); setShowForm(true); }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2L5 13l-3 1 1-3z"/></svg>
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button style={{ ...ICON_PILL, width: 22, height: 22 }}>
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete service?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(s._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent><DialogHeader><DialogTitle>{editSvc ? "Edit service" : "Add service"}</DialogTitle></DialogHeader>
          <ServiceForm initial={editSvc ?? undefined} onSave={() => { setShowForm(false); setEditSvc(null); mutate(); }} onClose={() => { setShowForm(false); setEditSvc(null); }} /></DialogContent>
      </Dialog>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .glass-card:hover .svc-actions{opacity:1!important}`}</style>
    </div>
  );
}
