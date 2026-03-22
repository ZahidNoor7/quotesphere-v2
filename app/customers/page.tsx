"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, getInitials } from "@/lib/utils";
import { T1, T2, T3, AC, AC2, GLASS, GLASS_BORDER, TABLE_WRAP, TOPBAR_STYLE, GLASS_INPUT, GLASS_SELECT, ICON_PILL, FIELD_INPUT, CARD } from "@/lib/ds";
import type { Customer } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const AV_COLORS = [
  "rgba(99,102,241,0.25)", "rgba(45,212,191,0.2)", "rgba(251,191,36,0.2)",
  "rgba(167,139,250,0.2)", "rgba(52,211,153,0.2)", "rgba(248,113,113,0.2)",
];
const AV_TEXT = ["#818cf8", "#2dd4bf", "#fbbf24", "#c4b5fd", "#34d399", "#f87171"];

function CustomerForm({ initial, onSave, onClose }: { initial?: Partial<Customer>; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? "", phone_no: initial?.phone_no ?? "", email: initial?.email ?? "", company: initial?.company ?? "", address: initial?.address ?? "", notes: initial?.notes ?? "" });
  const [loading, setLoading] = useState(false);
  const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value })) });

  async function save() {
    if (!form.name || !form.phone_no) { toast.error("Name and phone required."); return; }
    setLoading(true);
    try {
      const res = await fetch(initial?._id ? `/api/customers/${initial._id}` : "/api/customers", {
        method: initial?._id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(initial?._id ? "Client updated." : "Client added.");
      onSave();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;
  return (
    <>
      <div style={{ padding: "6px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>Full name *</label><input {...f("name")} placeholder="Jane Smith" style={FIELD_INPUT} /></div>
          <div><label style={lbl}>Phone *</label><input {...f("phone_no")} placeholder="+92 300 1234567" style={FIELD_INPUT} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>Email</label><input {...f("email")} type="email" placeholder="jane@co.com" style={FIELD_INPUT} /></div>
          <div><label style={lbl}>Company</label><input {...f("company")} placeholder="Company Ltd." style={FIELD_INPUT} /></div>
        </div>
        <div><label style={lbl}>Address</label><input {...f("address")} placeholder="Street, City" style={FIELD_INPUT} /></div>
        <div><label style={lbl}>Notes</label><input {...f("notes")} placeholder="Any notes..." style={FIELD_INPUT} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={save}>{initial?._id ? "Save changes" : "Add client"}</Button>
      </div>
    </>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Customer | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  const { data, mutate, isLoading } = useSWR(`/api/customers?${params}`, fetcher, { keepPreviousData: true });
  const customers: Customer[] = data?.data ?? [];
  const pagination = data?.pagination;

  async function del(id: string) {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    toast.success("Client deleted."); mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={TOPBAR_STYLE}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Clients</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button onClick={() => { setEditClient(null); setShowForm(true); }} size="sm">+ Add client</Button>
        </div>
      </div>

      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        {/* Mini KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, maxWidth: 360 }}>
          <div className="kpi-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>{pagination?.total ?? 0}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>Total clients</div>
          </div>
          <div className="kpi-card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#34d399" }}>{customers.filter(c => c.status).length}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>Active</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search clients..." style={{ ...GLASS_INPUT, flex: 1, minWidth: 140 }} />
          <select style={GLASS_SELECT}>
            <option>All status</option><option>Active</option><option>Inactive</option>
          </select>
          <select style={GLASS_SELECT}>
            <option>Sort: Recent</option><option>Sort: Revenue</option><option>Sort: Name</option>
          </select>
        </div>

        <div style={{ ...TABLE_WRAP, flex: 1, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <div style={{ width: 24, height: 24, border: "2px solid rgba(99,102,241,0.25)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : customers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 13, color: T2, marginBottom: 6 }}>No clients yet</div>
              <Button onClick={() => setShowForm(true)} size="sm">+ Add first client</Button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  {["Client", "Phone", "Jobs", "Total spent", "Status", ""].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase", width: h === "" ? 60 : h === "Jobs" ? 50 : h === "Status" ? 75 : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c._id} style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = "rgba(255,255,255,0.03)"))}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => (td.style.background = ""))}
                  >
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <Link href={`/customers/${c._id}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: AV_COLORS[i % AV_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: AV_TEXT[i % AV_TEXT.length], flexShrink: 0 }}>{getInitials(c.name)}</div>
                        <span style={{ color: T1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2 }}>{c.phone_no}</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: T2 }}>—</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)", color: "#34d399", fontWeight: 500 }}>—</td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <Badge variant={c.status ? "success" : "muted"}>{c.status ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td style={{ padding: "10px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={ICON_PILL} onClick={() => { setEditClient(c); setShowForm(true); }} title="Edit">
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 2.5l2 2L5 13l-3 1 1-3z"/></svg>
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button style={ICON_PILL}
                              onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" })}
                              onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: GLASS, color: T2, borderColor: GLASS_BORDER })}
                            >
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete {c.name}?</AlertDialogTitle><AlertDialogDescription>All client data will be removed.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del(c._id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
        <DialogContent>
          <DialogHeader><DialogTitle>{editClient ? "Edit client" : "Add new client"}</DialogTitle></DialogHeader>
          <CustomerForm initial={editClient ?? undefined} onSave={() => { setShowForm(false); setEditClient(null); mutate(); }} onClose={() => { setShowForm(false); setEditClient(null); }} />
        </DialogContent>
      </Dialog>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
