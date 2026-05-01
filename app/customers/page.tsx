"use client";
import { useState, useMemo, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import {
  Eye,
  Pencil,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  ChevronDown,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/card";
import { formatDate, getInitials } from "@/lib/utils";
import { T1, AC2, TOPBAR_STYLE, ICON_PILL, T3, FIELD_INPUT } from "@/lib/ds";
import {
  TableWrapper,
  DataTable,
  Th,
  Td,
  Tr,
  PaginationBar,
} from "@/components/custom-ui";
import { TableSkeleton } from "@/components/loaders";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import type { Customer } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SortDir = "asc" | "desc";
type SortableCol = "name" | "company" | "createdAt";

const COLUMNS = [
  { key: "name" as const, label: "Client", sortable: true },
  { key: "company" as const, label: "Company", sortable: true },
  { key: "phone_no" as const, label: "Phone", sortable: false },
  { key: "email" as const, label: "Email", sortable: false },
  { key: "status" as const, label: "Status", sortable: false },
  { key: "createdAt" as const, label: "Added", sortable: true },
] as const;

type ColKey = (typeof COLUMNS)[number]["key"];

const AV_COLORS = [
  "rgba(99,102,241,0.25)",
  "rgba(45,212,191,0.2)",
  "rgba(251,191,36,0.2)",
  "rgba(167,139,250,0.2)",
  "rgba(52,211,153,0.2)",
  "rgba(248,113,113,0.2)",
];
const AV_TEXT = [
  "#818cf8",
  "#2dd4bf",
  "#fbbf24",
  "#c4b5fd",
  "#34d399",
  "#f87171",
];

function SortIcon({
  col,
  sortCol,
  sortDir,
}: {
  col: SortableCol;
  sortCol: SortableCol | null;
  sortDir: SortDir;
}) {
  if (sortCol !== col)
    return <ArrowUpDown size={11} style={{ marginLeft: 3, opacity: 0.35 }} />;
  return sortDir === "asc" ? (
    <ArrowUp size={11} style={{ marginLeft: 3, opacity: 0.75 }} />
  ) : (
    <ArrowDown size={11} style={{ marginLeft: 3, opacity: 0.75 }} />
  );
}

// ─── Inline form component ──────────────────────────────────────────────────

function CustomerForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Customer>;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone_no: initial?.phone_no ?? "",
    email: initial?.email ?? "",
    company: initial?.company ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);

  const f = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value })),
  });

  async function save() {
    if (!form.name || !form.phone_no) {
      toast.error("Name and phone required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        initial?._id ? `/api/customers/${initial._id}` : "/api/customers",
        {
          method: initial?._id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(initial?._id ? "Client updated." : "Client added.");
      onSave();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const lbl = {
    fontSize: 11,
    color: T3,
    fontWeight: 500,
    marginBottom: 4,
    display: "block",
  } as const;

  return (
    <>
      <div
        style={{
          padding: "6px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label style={lbl}>Full name *</label>
            <Input {...f("name")} placeholder="Jane Smith" />
          </div>
          <div>
            <label style={lbl}>Phone *</label>
            <Input {...f("phone_no")} placeholder="+92 300 1234567" />
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <label style={lbl}>Email</label>
            <Input {...f("email")} type="email" placeholder="jane@co.com" />
          </div>
          <div>
            <label style={lbl}>Company</label>
            <Input {...f("company")} placeholder="Company Ltd." />
          </div>
        </div>
        <div>
          <label style={lbl}>Address</label>
          <Input {...f("address")} placeholder="Street, City" />
        </div>
        <div>
          <label style={lbl}>Notes</label>
          <Input {...f("notes")} placeholder="Any notes..." />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 18,
        }}
      >
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={loading} onClick={save}>
          {initial?._id ? "Save changes" : "Add client"}
        </Button>
      </div>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<SortableCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
    name: true,
    company: true,
    phone_no: true,
    email: true,
    status: true,
    createdAt: true,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Customer | null>(null);
  const isMobile = useIsMobile();

  const params = new URLSearchParams({ page: String(page), limit: "15" });
  if (search) params.set("search", search);
  if (statusFilter) params.set("status", statusFilter);

  const { data, mutate, isLoading, error } = useSWR(
    `/api/customers?${params}`,
    fetcher,
    { keepPreviousData: true },
  );
  const rawCustomers: Customer[] = data?.data ?? [];
  const pagination = data?.pagination;

  const customers = useMemo(() => {
    if (!sortCol) return rawCustomers;
    return [...rawCustomers].sort((a, b) => {
      const av = a[sortCol as keyof Customer];
      const bv = b[sortCol as keyof Customer];
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rawCustomers, sortCol, sortDir]);

  function toggleSort(col: SortableCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function handleSearch(v: string) {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 350);
  }

  const allIds = customers.map((c) => c._id);
  const allSel = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSel = !allSel && allIds.some((id) => selected.has(id));
  const selCount = allIds.filter((id) => selected.has(id)).length;

  function toggleAll() {
    setSelected((prev) => {
      const s = new Set(prev);
      if (allSel) allIds.forEach((id) => s.delete(id));
      else allIds.forEach((id) => s.add(id));
      return s;
    });
  }
  function toggleRow(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function del(id: string) {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    toast.success("Client deleted.");
    setSelected((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    setDeleteTarget(null);
    mutate();
  }

  async function bulkDelete() {
    const ids = allIds.filter((id) => selected.has(id));
    await Promise.all(
      ids.map((id) => fetch(`/api/customers/${id}`, { method: "DELETE" })),
    );
    toast.success(`${ids.length} client(s) deleted.`);
    setSelected(new Set());
    mutate();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div style={TOPBAR_STYLE}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: T1,
            letterSpacing: "-0.01em",
          }}
        >
          Clients
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Button
            size="sm"
            onClick={() => {
              setEditClient(null);
              setShowForm(true);
            }}
          >
            + Add client
          </Button>
        </div>
      </div>

      <div
        style={{
          padding: isMobile ? "12px 12px" : "18px 20px",
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--t3)",
                pointerEvents: "none",
              }}
            />
            <Input
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, phone, email..."
              style={{ paddingLeft: 28, height: 32 }}
            />
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter || "_all"}
            onValueChange={(v) => {
              setStatusFilter(v === "_all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger style={{ width: 130 }}>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Column visibility — desktop only */}
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    height: 32,
                  }}
                >
                  <SlidersHorizontal size={13} /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ minWidth: 160 }}>
                <DropdownMenuLabel style={{ fontSize: 11, opacity: 0.7 }}>
                  Toggle columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleCols[col.key]}
                    onCheckedChange={(v) =>
                      setVisibleCols((p) => ({ ...p, [col.key]: !!v }))
                    }
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* ── Bulk actions bar ─────────────────────────────────────────────── */}
        {selCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--glass)",
              border: "0.5px solid var(--glass-border)",
              borderRadius: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 12, color: T1, fontWeight: 500 }}>
              {selCount} selected
            </span>
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <Trash2 size={12} /> Delete ({selCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selCount} client(s)?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={bulkDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                size="sm"
                style={{ fontSize: 12 }}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* ── Table / Cards ────────────────────────────────────────────────── */}
        {isLoading ? (
          <TableWrapper style={{ flex: 1 }}><TableSkeleton cols={7} /></TableWrapper>
        ) : error ? (
          <TableWrapper style={{ flex: 1 }}><ErrorState message="Failed to load customers." onRetry={() => mutate()} /></TableWrapper>
        ) : customers.length === 0 ? (
          <TableWrapper style={{ flex: 1 }}>
            <EmptyState
              icon={Users}
              title="No clients found"
              description="Add your first client to get started"
              action={
                <Button size="sm" onClick={() => { setEditClient(null); setShowForm(true); }}>
                  + Add client
                </Button>
              }
            />
          </TableWrapper>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {customers.map((c, i) => (
              <div
                key={c._id}
                style={{
                  background: selected.has(c._id)
                    ? "var(--glass-hover)"
                    : "var(--glass)",
                  border: `0.5px solid ${selected.has(c._id) ? "rgba(99,102,241,0.35)" : "var(--glass-border)"}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Row 1: checkbox + avatar + name + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox
                    checked={selected.has(c._id)}
                    onCheckedChange={() => toggleRow(c._id)}
                  />
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: AV_COLORS[i % AV_COLORS.length],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      color: AV_TEXT[i % AV_TEXT.length],
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(c.name)}
                  </div>
                  <Link
                    href={`/customers/${c._id}`}
                    style={{
                      flex: 1,
                      color: T1,
                      fontWeight: 600,
                      fontSize: 13,
                      textDecoration: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ ...ICON_PILL, width: 28, height: 28 }} aria-label="Open customer actions">
                        <MoreVertical size={13} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" style={{ minWidth: 168 }}>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/customers/${c._id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                          }}
                        >
                          <Eye size={13} /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onClick={() => {
                          setEditClient(c);
                          setShowForm(true);
                        }}
                      >
                        <Pencil size={13} /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        style={{
                          color: "#f87171",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Row 2: company + phone */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    paddingLeft: 26,
                    flexWrap: "wrap",
                  }}
                >
                  {c.company && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--t2)",
                        fontWeight: 500,
                      }}
                    >
                      {c.company}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--t2)" }}>
                    {c.phone_no}
                  </span>
                  {c.email && (
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>
                      {c.email}
                    </span>
                  )}
                </div>

                {/* Row 3: status badge + date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    paddingLeft: 26,
                    flexWrap: "wrap",
                  }}
                >
                  <Badge variant={c.status ? "success" : "muted"}>
                    {c.status ? "Active" : "Inactive"}
                  </Badge>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--t3)",
                      marginLeft: "auto",
                    }}
                  >
                    {formatDate(c.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Desktop table ── */
          <TableWrapper style={{ flex: 1, overflowY: "auto" }}>
            <DataTable>
              <thead>
                <tr>
                  <Th style={{ width: 40 }}>
                    <Checkbox
                      checked={someSel ? "indeterminate" : allSel}
                      onCheckedChange={toggleAll}
                    />
                  </Th>
                  {visibleCols.name && (
                    <Th
                      style={{ cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("name")}
                    >
                      <span
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        Client{" "}
                        <SortIcon
                          col="name"
                          sortCol={sortCol}
                          sortDir={sortDir}
                        />
                      </span>
                    </Th>
                  )}
                  {visibleCols.company && (
                    <Th
                      style={{ cursor: "pointer", userSelect: "none" }}
                      onClick={() => toggleSort("company")}
                    >
                      <span
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        Company{" "}
                        <SortIcon
                          col="company"
                          sortCol={sortCol}
                          sortDir={sortDir}
                        />
                      </span>
                    </Th>
                  )}
                  {visibleCols.phone_no && (
                    <Th style={{ width: 140 }}>Phone</Th>
                  )}
                  {visibleCols.email && <Th>Email</Th>}
                  {visibleCols.status && <Th style={{ width: 90 }}>Status</Th>}
                  {visibleCols.createdAt && (
                    <Th
                      style={{
                        width: 90,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleSort("createdAt")}
                    >
                      <span
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        Added{" "}
                        <SortIcon
                          col="createdAt"
                          sortCol={sortCol}
                          sortDir={sortDir}
                        />
                      </span>
                    </Th>
                  )}
                  <Th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <Tr
                    key={c._id}
                    style={
                      selected.has(c._id)
                        ? { background: "var(--glass-hover)" }
                        : undefined
                    }
                  >
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(c._id)}
                        onCheckedChange={() => toggleRow(c._id)}
                      />
                    </Td>
                    {visibleCols.name && (
                      <Td>
                        <Link
                          href={`/customers/${c._id}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              background: AV_COLORS[i % AV_COLORS.length],
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 600,
                              color: AV_TEXT[i % AV_TEXT.length],
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(c.name)}
                          </div>
                          <span
                            style={{
                              color: T1,
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.name}
                          </span>
                        </Link>
                      </Td>
                    )}
                    {visibleCols.company && (
                      <Td style={{ color: "var(--t2)" }}>{c.company || "—"}</Td>
                    )}
                    {visibleCols.phone_no && (
                      <Td style={{ color: "var(--t2)" }}>{c.phone_no}</Td>
                    )}
                    {visibleCols.email && (
                      <Td style={{ color: "var(--t3)" }}>{c.email || "—"}</Td>
                    )}
                    {visibleCols.status && (
                      <Td>
                        <Badge variant={c.status ? "success" : "muted"}>
                          {c.status ? "Active" : "Inactive"}
                        </Badge>
                      </Td>
                    )}
                    {visibleCols.createdAt && (
                      <Td style={{ color: "var(--t3)" }}>
                        {formatDate(c.createdAt)}
                      </Td>
                    )}

                    {/* Row actions dropdown */}
                    <Td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            style={{ ...ICON_PILL, width: 28, height: 28 }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Open customer actions"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          style={{ minWidth: 168 }}
                        >
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/customers/${c._id}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                              }}
                            >
                              <Eye size={13} /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                            onClick={() => {
                              setEditClient(c);
                              setShowForm(true);
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            style={{
                              color: "#f87171",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 size={13} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        )}

        <PaginationBar
          page={page}
          pagination={pagination}
          onPrev={() => setPage((p) => p - 1)}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>

      {/* State-controlled delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All client data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && del(deleteTarget._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editClient ? "Edit client" : "Add new client"}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            initial={editClient ?? undefined}
            onSave={() => {
              setShowForm(false);
              setEditClient(null);
              mutate();
            }}
            onClose={() => {
              setShowForm(false);
              setEditClient(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
