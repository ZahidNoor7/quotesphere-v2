"use client";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanSelector } from "@/components/billing/plan-selector";
import type { Entitlements } from "@/types";

const T1 = "#eef0ff";
const T3 = "rgba(160,170,255,0.5)";

/**
 * Full-screen blocker shown (in place of the app) when a tenant's subscription is
 * inactive. For an EXPIRED subscription it also surfaces the plan selector so an
 * admin can request a renewal right here (request → owner approves, manual billing).
 * For an admin-SUSPENDED account it stays a contact-your-administrator block.
 */
export function SubscriptionBlocked({ entitlements }: { entitlements: Entitlements }) {
  const router = useRouter();
  const suspended = entitlements.effectiveStatus === "suspended";

  return (
    <div style={{ minHeight: "100dvh", overflowY: "auto", background: "#0d1120", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(248,113,113,0.14)" }}>
            <Lock size={26} color="#f87171" />
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: T1 }}>
            {suspended ? "Account suspended" : "Subscription expired"}
          </h1>
          <p style={{ fontSize: 14, color: T3, maxWidth: 460, lineHeight: 1.6 }}>
            {suspended
              ? (entitlements.message ?? "Your account has been suspended. Please contact your administrator to restore access.")
              : "Your subscription has ended. Choose a plan below to request a renewal — your provider will review and reactivate your access."}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="outline" onClick={() => router.refresh()}>
              <RefreshCw size={14} /> Re-check
            </Button>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/auth/login" })}>
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        </div>

        {/* Expired tenants can request a renewal / plan right here. */}
        {!suspended && <PlanSelector showCurrent={false} />}
      </div>
    </div>
  );
}
