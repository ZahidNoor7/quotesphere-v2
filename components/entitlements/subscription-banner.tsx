"use client";
import { AlertTriangle, Clock, CalendarX } from "lucide-react";
import { useEntitlements } from "@/hooks/use-entitlements";

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

/**
 * Slim, persistent reminder banner for trialing / past_due / canceled states.
 * Rendered inside the app shell; renders nothing when fully active or blocked
 * (the blocked case is handled by the layout swapping in <SubscriptionBlocked/>).
 */
export function SubscriptionBanner() {
  const { entitlements } = useEntitlements();
  if (!entitlements || entitlements.access === "blocked") return null;

  let tone: { bg: string; color: string; icon: React.ReactNode; text: string } | null = null;

  if (entitlements.notice === "trial") {
    const d = daysUntil(entitlements.trialEndsAt);
    tone = {
      bg: "rgba(129,140,248,0.12)", color: "#a5b4fc", icon: <Clock size={14} />,
      text: d != null ? `You're on a free trial — ${d} day${d === 1 ? "" : "s"} left.` : "You're on a free trial.",
    };
  } else if (entitlements.notice === "past_due") {
    const d = daysUntil(entitlements.graceEndsAt);
    tone = {
      bg: "rgba(251,191,36,0.14)", color: "#fcd34d", icon: <AlertTriangle size={14} />,
      text: d != null
        ? `Payment overdue — ${d} day${d === 1 ? "" : "s"} left before access is blocked. Please contact your administrator.`
        : "Payment overdue. Please contact your administrator.",
    };
  } else if (entitlements.notice === "canceled") {
    tone = {
      bg: "rgba(148,163,184,0.14)", color: "#cbd5e1", icon: <CalendarX size={14} />,
      text: `Subscription ends on ${fmtDate(entitlements.periodEndsAt)}.`,
    };
  }

  if (!tone) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", fontSize: 12.5, fontWeight: 500,
        background: tone.bg, color: tone.color,
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      {tone.icon}
      <span>{tone.text}</span>
    </div>
  );
}
