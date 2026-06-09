"use client";
import { useSession } from "next-auth/react";
import { Wallet, ShieldAlert } from "lucide-react";
import { PayrollTabs } from "@/components/payroll/payroll-tabs";
import { TOPBAR_STYLE, T1, T3, AC2 } from "@/lib/ds";

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: T3, textAlign: "center", padding: 24 }}>
        <ShieldAlert size={28} />
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Admins only</div>
        <div style={{ fontSize: 13, maxWidth: 360 }}>The Payroll module is restricted to administrators. Ask an admin for access.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ ...TOPBAR_STYLE }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Wallet size={15} style={{ color: AC2 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Payroll</div>
        </div>
        <div style={{ marginLeft: 14, flex: 1, minWidth: 0 }}>
          <PayrollTabs />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
