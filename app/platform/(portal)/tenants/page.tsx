"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlatformTenants } from "@/hooks/use-platform";
import { SubscriptionStatusBadge } from "@/components/platform/subscription-status-badge";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { SearchFilterBar, FilterSelect } from "@/components/custom-ui/search-filter-bar";
import { PaginationBar } from "@/components/custom-ui/pagination-bar";
import { SelectItem } from "@/components/ui/select";
import { ArrowUpRight, ArrowDownRight, ArrowRightLeft } from "lucide-react";
import { T1, T2, T3 } from "@/lib/ds";

const STATUS_OPTS = ["trialing", "active", "past_due", "canceled", "expired", "suspended"];
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

function RequestPill({ pending }: { pending?: { plan_name: string; direction: string } | null }) {
  if (!pending) return <span style={{ color: T3 }}>—</span>;
  const Icon = pending.direction === "upgrade" ? ArrowUpRight : pending.direction === "downgrade" ? ArrowDownRight : ArrowRightLeft;
  return (
    <span
      title={`Requested: ${pending.plan_name} (${pending.direction})`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#a5b4fc", background: "rgba(129,140,248,0.14)", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" }}
    >
      <Icon size={12} /> {pending.plan_name || "Requested"}
    </span>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { tenants, pagination, isLoading } = usePlatformTenants({
    page, search, status: status === "all" ? "" : status,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>Tenants</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>
          {pagination ? `${pagination.total} organization${pagination.total === 1 ? "" : "s"}` : "Organizations"}
        </div>
      </div>

      <SearchFilterBar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search tenants…"
      >
        <FilterSelect
          value={status}
          onValueChange={(v) => { setStatus(v); setPage(1); }}
          placeholder="All statuses"
        >
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTS.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
          ))}
        </FilterSelect>
      </SearchFilterBar>

      <TableWrapper>
        <DataTable>
          <thead>
            <Tr>
              <Th>Tenant</Th>
              <Th>Owner</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <Th>Request</Th>
              <Th>Trial ends</Th>
              <Th>Renews</Th>
              <Th>Created</Th>
            </Tr>
          </thead>
          <tbody>
            {isLoading && tenants.length === 0 ? (
              <Tr><Td colSpan={8} style={{ textAlign: "center", color: T3, padding: 28 }}>Loading…</Td></Tr>
            ) : tenants.length === 0 ? (
              <Tr><Td colSpan={8} style={{ textAlign: "center", color: T3, padding: 28 }}>No tenants found.</Td></Tr>
            ) : (
              tenants.map((t) => (
                <Tr key={t.org_id} onClick={() => router.push(`/platform/tenants/${t.org_id}`)}>
                  <Td style={{ color: T1, fontWeight: 500 }}>{t.org_name}</Td>
                  <Td style={{ color: T2 }}>{t.owner_email ?? "—"}</Td>
                  <Td style={{ color: T2 }}>{t.plan_name ?? "—"}</Td>
                  <Td><SubscriptionStatusBadge status={t.effectiveStatus} /></Td>
                  <Td><RequestPill pending={t.pending_request} /></Td>
                  <Td style={{ color: T2 }}>{fmtDate(t.trial_ends_at)}</Td>
                  <Td style={{ color: T2 }}>{fmtDate(t.current_period_end)}</Td>
                  <Td style={{ color: T2 }}>{fmtDate(t.created_at)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </DataTable>
      </TableWrapper>

      <PaginationBar
        page={page}
        pagination={pagination}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
