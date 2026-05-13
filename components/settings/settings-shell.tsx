"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Building2, Paintbrush, FileText, Users, AlertTriangle, Plug, UserCircle } from "lucide-react";
import { T1, T2, T3, GLASS_BORDER } from "@/lib/ds";

const NAV = [
  { label: "General", href: "/settings/general", icon: Building2 },
  { label: "Appearance", href: "/settings/appearance", icon: Paintbrush },
  { label: "Documents", href: "/settings/document", icon: FileText },
  { label: "Integrations", href: "/settings/integrations", icon: Plug },
  { label: "Team", href: "/settings/team", icon: Users },
  { label: "Profile", href: "/settings/profile", icon: UserCircle },
  { label: "Danger", href: "/settings/danger", icon: AlertTriangle, danger: true },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/settings/document-design")) return <>{children}</>;

  const isActive = (href: string) => pathname === href;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px 0",
        borderBottom: `0.5px solid ${GLASS_BORDER}`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: T1, marginBottom: 4 }}>Settings</div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 16 }}>
          Manage your company info, appearance, documents, and team.
        </div>

        {/* Horizontal tabs */}
        <div style={{
          display: "flex",
          overflowX: "auto",
          scrollbarWidth: "none",
          gap: 0,
          marginBottom: -1,
        } as React.CSSProperties}>
          {NAV.map(item => {
            const active = isActive(item.href);
            const color = active ? "#818cf8" : item.danger ? "#f87171" : T2;
            return (
              <Link key={item.href} href={item.href} style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 16px",
                borderBottom: active ? "2px solid #818cf8" : "2px solid transparent",
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color,
                whiteSpace: "nowrap",
                textDecoration: "none",
                transition: "color 0.15s",
              }}>
                <item.icon size={14} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {children}
      </div>
    </div>
  );
}
