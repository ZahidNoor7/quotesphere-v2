"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Building2, Tags, CreditCard, Settings, ShieldCheck, LogOut } from "lucide-react";
import { usePlatformPendingRequests } from "@/hooks/use-platform";
import { T1, T2, T3, GLASS_BORDER } from "@/lib/ds";

const NAV = [
  { label: "Overview", href: "/platform", icon: LayoutDashboard },
  { label: "Tenants", href: "/platform/tenants", icon: Building2 },
  { label: "Plans", href: "/platform/plans", icon: Tags },
  { label: "Subscriptions", href: "/platform/subscriptions", icon: CreditCard },
  { label: "Settings", href: "/platform/settings", icon: Settings },
];

export function PlatformShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { count: pendingCount } = usePlatformPendingRequests();
  // Overview is the root — exact match only; the rest match their prefix.
  const isActive = (href: string) =>
    href === "/platform" ? pathname === "/platform" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px 0", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: 9,
                background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <ShieldCheck size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T1, lineHeight: 1.2 }}>Platform Console</div>
              <div style={{ fontSize: 11.5, color: T3 }}>{adminName}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/platform/login" })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
              padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, color: T2,
              background: "transparent", border: `0.5px solid ${GLASS_BORDER}`, transition: "color 0.15s",
            }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>

        {/* Horizontal tabs */}
        <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", marginBottom: -1 } as React.CSSProperties}>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 16px",
                  borderBottom: active ? "2px solid #818cf8" : "2px solid transparent",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? "#818cf8" : T2, whiteSpace: "nowrap", textDecoration: "none",
                  transition: "color 0.15s",
                }}
              >
                <item.icon size={14} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
                {item.href === "/platform/tenants" && pendingCount > 0 && (
                  <span
                    title={`${pendingCount} pending plan request${pendingCount === 1 ? "" : "s"}`}
                    style={{
                      minWidth: 17, height: 17, padding: "0 5px", borderRadius: 999,
                      background: "#818cf8", color: "#fff", fontSize: 10.5, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
    </div>
  );
}
