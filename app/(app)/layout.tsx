import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEntitlements } from "@/lib/entitlements/resolve";
import { SubscriptionBlocked } from "@/components/entitlements/subscription-blocked";
import { AuthGuard } from "@/components/layout/auth-guard";

// Always re-evaluate auth on the server (no static/RSC caching of authed pages).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/auth/login");
  // Platform super-admins don't belong in the tenant app.
  if (session.user?.isPlatformAdmin) redirect("/platform");

  // Subscription status gate — expired / suspended / past-grace tenants are blocked
  // (server-side, before any app content renders). trialing / active / in-grace /
  // canceled-before-period pass through.
  const orgId = session.user?.org_id;
  if (orgId) {
    const ent = await resolveEntitlements(orgId);
    if (ent.access === "blocked") {
      return (
        <AuthGuard audience="tenant" loginPath="/auth/login">
          <SubscriptionBlocked entitlements={ent} />
        </AuthGuard>
      );
    }
  }

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("qs-sidebar-collapsed")?.value === "true";
  return (
    <AuthGuard audience="tenant" loginPath="/auth/login">
      <AppShell initialCollapsed={initialCollapsed}>{children}</AppShell>
    </AuthGuard>
  );
}
