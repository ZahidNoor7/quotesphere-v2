"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlatformOverview, usePlatformPendingRequests } from "@/hooks/use-platform";
import { SubscriptionStatusBadge } from "@/components/platform/subscription-status-badge";
import { TableWrapper, DataTable, Th, Td, Tr } from "@/components/custom-ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { CARD, T1, T2, T3 } from "@/lib/ds";
import type { SubscriptionStatus } from "@/types";

const STAT_ORDER: { key: SubscriptionStatus | "total"; label: string; accent?: string }[] = [
  { key: "total", label: "Total tenants" },
  { key: "trialing", label: "Trialing", accent: "#a5b4fc" },
  { key: "active", label: "Active", accent: "#6ee7b7" },
  { key: "past_due", label: "Past due", accent: "#fcd34d" },
  { key: "expired", label: "Expired", accent: "#fca5a5" },
  { key: "suspended", label: "Suspended", accent: "#f87171" },
];

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function daysLeft(iso?: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function PlatformOverviewPage() {
  const { overview, isLoading } = usePlatformOverview();
  const { requests: pendingRequests } = usePlatformPendingRequests();
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: T1 }}>Overview</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Platform-wide tenants, revenue and expiring trials.</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {STAT_ORDER.map((s) => (
          <div key={s.key} style={{ ...CARD, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: T3, fontWeight: 500, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.accent ?? T1, lineHeight: 1 }}>
              {isLoading ? "—" : (overview?.counts?.[s.key] ?? 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Pending plan requests */}
      {pendingRequests.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T1 }}>Pending plan requests</span>
            <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, background: "#818cf8", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {pendingRequests.length}
            </span>
          </div>
          <TableWrapper>
            <DataTable>
              <thead>
                <Tr><Th>Tenant</Th><Th>Requested plan</Th><Th>Type</Th><Th>Requested</Th></Tr>
              </thead>
              <tbody>
                {pendingRequests.map((r) => (
                  <Tr key={r.org_id} onClick={() => router.push(`/platform/tenants/${r.org_id}`)}>
                    <Td style={{ color: T1, fontWeight: 500 }}>{r.org_name}</Td>
                    <Td style={{ color: T2 }}>{r.plan_name || "—"}</Td>
                    <Td style={{ color: T2, textTransform: "capitalize" }}>{r.direction}</Td>
                    <Td style={{ color: T2 }}>{fmtDate(r.requested_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrapper>
        </div>
      )}

      {/* Revenue */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T1, marginBottom: 10 }}>Revenue collected</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {(["PKR", "USD"] as const).map((cur) => {
            const total = overview?.revenue?.find((r) => r.currency === cur)?.total ?? 0;
            return (
              <div key={cur} style={{ ...CARD, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: T3, fontWeight: 500, marginBottom: 6 }}>{cur} total</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: T1, lineHeight: 1 }}>
                  {formatCurrency(total, cur, cur === "USD" ? "en-US" : "en-PK")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trials expiring soon */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T1, marginBottom: 10 }}>Trials expiring soon</div>
        {(overview?.trialsExpiringSoon?.length ?? 0) === 0 ? (
          <div style={{ ...CARD, padding: 20, fontSize: 13, color: T3, textAlign: "center" }}>
            No trials ending in the next 7 days.
          </div>
        ) : (
          <TableWrapper>
            <DataTable>
              <thead>
                <Tr>
                  <Th>Tenant</Th>
                  <Th>Plan</Th>
                  <Th>Trial ends</Th>
                  <Th style={{ textAlign: "right" }}>Days left</Th>
                </Tr>
              </thead>
              <tbody>
                {overview!.trialsExpiringSoon.map((t) => {
                  const d = daysLeft(t.trial_ends_at);
                  return (
                    <Tr key={t.org_id} onClick={() => { window.location.href = `/platform/tenants/${t.org_id}`; }}>
                      <Td style={{ color: T1, fontWeight: 500 }}>
                        <Link href={`/platform/tenants/${t.org_id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {t.org_name}
                        </Link>
                      </Td>
                      <Td style={{ color: T2 }}>{t.plan_name ?? "—"}</Td>
                      <Td style={{ color: T2 }}>{fmtDate(t.trial_ends_at)}</Td>
                      <Td style={{ textAlign: "right", color: d != null && d <= 2 ? "#fca5a5" : T2 }}>
                        {d != null ? `${d}d` : "—"}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
