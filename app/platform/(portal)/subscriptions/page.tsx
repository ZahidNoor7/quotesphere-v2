"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlatformSubscriptions } from "@/hooks/use-platform";
import { SubscriptionStatusBadge } from "@/components/platform/subscription-status-badge";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { FilterSelect } from "@/components/custom-ui/search-filter-bar";
import { PaginationBar } from "@/components/custom-ui/pagination-bar";
import { SelectItem } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { CARD, T1, T2, T3 } from "@/lib/ds";

const STATUS_OPTS = ["trialing", "active", "past_due", "canceled", "expired", "suspended"];
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function SubscriptionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const { subscriptions, payments, pagination, isLoading } = usePlatformSubscriptions({
    page, status: status === "all" ? "" : status,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>Subscriptions</div>
          <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>{pagination ? `${pagination.total} total` : "All subscriptions"}</div>
        </div>
        <FilterSelect value={status} onValueChange={(v) => { setStatus(v); setPage(1); }} placeholder="All statuses">
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
        </FilterSelect>
      </div>

      <TableWrapper>
        <DataTable>
          <thead>
            <Tr><Th>Tenant</Th><Th>Plan</Th><Th>Status</Th><Th>Trial ends</Th><Th>Renews</Th><Th>Updated</Th></Tr>
          </thead>
          <tbody>
            {isLoading && subscriptions.length === 0 ? (
              <Tr><Td colSpan={6} style={{ textAlign: "center", color: T3, padding: 26 }}>Loading…</Td></Tr>
            ) : subscriptions.length === 0 ? (
              <Tr><Td colSpan={6} style={{ textAlign: "center", color: T3, padding: 26 }}>No subscriptions.</Td></Tr>
            ) : (
              subscriptions.map((s) => (
                <Tr key={s.org_id} onClick={() => router.push(`/platform/tenants/${s.org_id}`)}>
                  <Td style={{ color: T1, fontWeight: 500 }}>{s.org_name}</Td>
                  <Td style={{ color: T2 }}>{s.plan_name ?? "—"}{s.currency ? ` · ${s.currency}` : ""}</Td>
                  <Td><SubscriptionStatusBadge status={s.effectiveStatus} /></Td>
                  <Td style={{ color: T2 }}>{fmtDate(s.trial_ends_at)}</Td>
                  <Td style={{ color: T2 }}>{fmtDate(s.current_period_end)}</Td>
                  <Td style={{ color: T2 }}>{fmtDate(s.updatedAt)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </DataTable>
      </TableWrapper>

      <PaginationBar page={page} pagination={pagination} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />

      {/* Recent payments */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T1, marginBottom: 10 }}>Recent payments</div>
        {payments.length === 0 ? (
          <div style={{ ...CARD, padding: 18, fontSize: 12.5, color: T3, textAlign: "center" }}>No payments recorded.</div>
        ) : (
          <TableWrapper>
            <DataTable>
              <thead>
                <Tr><Th>Date</Th><Th>Tenant</Th><Th>Amount</Th><Th>Status</Th><Th>Method</Th></Tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <Tr key={i}>
                    <Td style={{ color: T2 }}>{fmtDate(p.createdAt)}</Td>
                    <Td style={{ color: T1, fontWeight: 500 }}>{p.org_name}</Td>
                    <Td style={{ color: T1 }}>{formatCurrency(p.amount, p.currency, p.currency === "USD" ? "en-US" : "en-PK")}</Td>
                    <Td style={{ color: T2 }}>{p.status}</Td>
                    <Td style={{ color: T2 }}>{p.method}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
