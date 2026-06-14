import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlatformShell } from "@/components/platform/platform-shell";
import { AuthGuard } from "@/components/layout/auth-guard";

// Always re-evaluate on the server (no static/RSC caching of authenticated pages).
export const dynamic = "force-dynamic";

/**
 * Server-side guard for the owner portal. The real protection lives here (Node
 * runtime, full session) — the edge proxy only does coarse redirects. A
 * non-platform-admin is bounced to the platform login with no portal content
 * ever rendered (no disclosure). `PlatformAuthGuard` adds the client-side guard
 * so back/forward and bfcache restores after logout can't re-show cached pages.
 */
export default async function PlatformPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) redirect("/platform/login");
  const adminName = session.user.name || session.user.email || "Admin";
  return (
    <AuthGuard audience="platform" loginPath="/platform/login">
      <PlatformShell adminName={adminName}>{children}</PlatformShell>
    </AuthGuard>
  );
}
