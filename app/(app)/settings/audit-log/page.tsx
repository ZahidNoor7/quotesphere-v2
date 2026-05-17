"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import {
  Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { T1, T2, T3, GLASS_BORDER, TABLE_STYLE, TH_STYLE, TD_STYLE, TABLE_WRAP } from "@/lib/ds";
import { diffSnapshots } from "@/lib/audit-utils";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const RESOURCES = ["invoice", "quotation", "expense", "project", "customer", "service", "product", "settings"];
const ACTIONS   = ["create", "update", "delete"];

const ACTION_META: Record<string, { label: string; color: string; bg: string; Icon: typeof Plus }> = {
  create: { label: "Created", color: "#34d399", bg: "rgba(52,211,153,0.12)",  Icon: Plus    },
  update: { label: "Updated", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  Icon: Pencil  },
  delete: { label: "Deleted", color: "#f87171", bg: "rgba(248,113,113,0.12)", Icon: Trash2  },
};

function DiffView({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const diff = useMemo(() => diffSnapshots(before, after), [before, after]);
  const entries = Object.entries(diff);
  if (!entries.length) return <p style={{ fontSize: 11, color: T3, margin: 0 }}>No field changes recorded.</p>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr>
          {["Field", "Before", "After"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: T3, fontWeight: 600, borderBottom: `0.5px solid ${GLASS_BORDER}` }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, { before: b, after: a }]) => (
          <tr key={key}>
            <td style={{ padding: "4px 8px", color: T2, fontFamily: "monospace", whiteSpace: "nowrap" }}>{key}</td>
            <td style={{ padding: "4px 8px", color: "#f87171", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b === null || b === undefined ? <em style={{ opacity: 0.5 }}>—</em> : String(b)}
            </td>
            <td style={{ padding: "4px 8px", color: "#34d399", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a === null || a === undefined ? <em style={{ opacity: 0.5 }}>—</em> : String(a)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditRow({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[entry.action] ?? ACTION_META.update;
  const Icon = meta.Icon;
  const hasDiff = entry.action === "update" && (entry.before || entry.after);
  const hasSnapshot = entry.action !== "update" && (entry.before || entry.after);

  return (
    <>
      <tr
        className="table-row-hover"
        style={{ cursor: (hasDiff || hasSnapshot) ? "pointer" : "default" }}
        onClick={() => (hasDiff || hasSnapshot) && setExpanded(v => !v)}
      >
        {/* Action badge */}
        <td style={TD_STYLE}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 100, background: meta.bg, color: meta.color, whiteSpace: "nowrap" as const }}>
            <Icon size={9} />
            {meta.label}
          </span>
        </td>
        {/* Resource */}
        <td style={TD_STYLE}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T1, textTransform: "capitalize" as const }}>{entry.resource}</span>
          {entry.resource_label && (
            <span style={{ fontSize: 11, color: T3, marginLeft: 6, fontFamily: "monospace" }}>{entry.resource_label}</span>
          )}
        </td>
        {/* User */}
        <td style={{ ...TD_STYLE, color: T2 }}>
          <div style={{ fontSize: 12 }}>{entry.user_name || "—"}</div>
          {entry.user_email && <div style={{ fontSize: 10, color: T3 }}>{entry.user_email}</div>}
        </td>
        {/* Time */}
        <td style={{ ...TD_STYLE, color: T3, whiteSpace: "nowrap" as const, fontSize: 11 }}>
          {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm") : "—"}
        </td>
        {/* IP */}
        <td style={{ ...TD_STYLE, color: T3, fontSize: 10, fontFamily: "monospace" }}>{entry.ip || "—"}</td>
        {/* Expand toggle */}
        <td style={{ ...TD_STYLE, width: 28 }}>
          {(hasDiff || hasSnapshot) && (
            expanded
              ? <ChevronDown size={13} style={{ color: T3 }} />
              : <ChevronRight size={13} style={{ color: T3 }} />
          )}
        </td>
      </tr>

      {/* Expandable diff / snapshot */}
      {expanded && (hasDiff || hasSnapshot) && (
        <tr>
          <td colSpan={6} style={{ padding: "10px 16px 14px", background: "rgba(255,255,255,0.015)", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
            {hasDiff ? (
              <DiffView before={entry.before} after={entry.after} />
            ) : entry.action === "create" ? (
              <pre style={{ fontSize: 10, color: T3, margin: 0, overflow: "auto", maxHeight: 200 }}>
                {JSON.stringify(entry.after, null, 2)}
              </pre>
            ) : (
              <pre style={{ fontSize: 10, color: "#f87171", margin: 0, overflow: "auto", maxHeight: 200 }}>
                {JSON.stringify(entry.before, null, 2)}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogPage() {
  const TODAY = new Date().toISOString().slice(0, 10);

  const [resource, setResource] = useState("");
  const [action,   setAction]   = useState("");
  const [search,   setSearch]   = useState("");
  const [from,     setFrom]     = useState(TODAY);
  const [to,       setTo]       = useState(TODAY);
  const [page,     setPage]     = useState(1);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", "30");
    if (resource) p.set("resource", resource);
    if (action)   p.set("action",   action);
    if (search)   p.set("search",   search);
    if (from)     p.set("from",     from);
    if (to)       p.set("to",       to);
    return p.toString();
  }, [page, resource, action, search, from, to]);

  const { data, isLoading, mutate } = useSWR(
    `/api/audit-log?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const entries: any[] = data?.data ?? [];
  const pagination = data?.pagination;

  function reset() {
    setResource(""); setAction(""); setSearch(""); setFrom(TODAY); setTo(TODAY); setPage(1);
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1, marginBottom: 4 }}>Audit Log</div>
        <div style={{ fontSize: 12, color: T3 }}>
          Full history of every create, update, and delete across invoices, customers, projects, and more.
          Entries expire automatically after 2 years.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by doc number…"
          style={{ width: 200, borderRadius: 100 }}
        />
        <Select value={resource || "all"} onValueChange={v => { setResource(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger style={{ width: 140 }}><SelectValue placeholder="All resources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {RESOURCES.map(r => <SelectItem key={r} value={r} style={{ textTransform: "capitalize" }}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action || "all"} onValueChange={v => { setAction(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger style={{ width: 130 }}><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map(a => <SelectItem key={a} value={a} style={{ textTransform: "capitalize" }}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} style={{ width: 145 }} />
        <Input type="date" value={to}   onChange={e => { setTo(e.target.value);   setPage(1); }} style={{ width: 145 }} />
        <Button variant="ghost" size="sm" onClick={reset}>Clear</Button>
        <Button variant="ghost" size="sm" onClick={() => mutate()} style={{ marginLeft: "auto" }}>
          <RefreshCw size={13} style={{ marginRight: 4 }} /> Refresh
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T3, fontSize: 13 }}>
          No audit log entries found.{" "}
          {(resource || action || search || from || to) && (
            <button onClick={reset} style={{ color: "#818cf8", background: "none", border: "none", cursor: "pointer" }}>Clear filters</button>
          )}
        </div>
      ) : (
        <>
          <div style={TABLE_WRAP}>
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  {["Action", "Resource", "User", "Time", "IP", ""].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => <AuditRow key={e._id} entry={e} />)}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 16 }}>
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <span style={{ fontSize: 12, color: T2 }}>Page {page} of {pagination.pages} · {pagination.total} entries</span>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
