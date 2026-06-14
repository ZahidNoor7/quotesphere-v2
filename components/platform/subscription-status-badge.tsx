import type { SubscriptionStatus } from "@/types";

const STYLES: Record<SubscriptionStatus, { bg: string; color: string; label: string }> = {
  trialing:  { bg: "rgba(129,140,248,0.14)", color: "#a5b4fc", label: "Trialing" },
  active:    { bg: "rgba(52,211,153,0.14)",  color: "#6ee7b7", label: "Active" },
  past_due:  { bg: "rgba(251,191,36,0.16)",  color: "#fcd34d", label: "Past due" },
  canceled:  { bg: "rgba(148,163,184,0.16)", color: "#cbd5e1", label: "Canceled" },
  expired:   { bg: "rgba(248,113,113,0.15)", color: "#fca5a5", label: "Expired" },
  suspended: { bg: "rgba(248,113,113,0.22)", color: "#f87171", label: "Suspended" },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = STYLES[status] ?? STYLES.expired;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", padding: "2px 9px",
        borderRadius: 999, fontSize: 11.5, fontWeight: 600,
        background: s.bg, color: s.color, whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
