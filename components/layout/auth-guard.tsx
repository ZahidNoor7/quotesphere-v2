"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, getSession } from "next-auth/react";
import type { Session } from "next-auth";

type Audience = "tenant" | "platform";

/**
 * Where this session should be sent (or null to stay). The server layout already
 * guards fresh requests; this covers back/forward (Next router cache) and bfcache
 * restores after logout, which can re-show a cached authenticated page with no new
 * server request.
 */
function redirectTarget(session: Session | null, audience: Audience, loginPath: string): string | null {
  if (audience === "platform") {
    return session?.user?.isPlatformAdmin ? null : loginPath;
  }
  // tenant app
  if (!session?.user) return loginPath;               // logged out → tenant login
  if (session.user.isPlatformAdmin) return "/platform"; // platform admin doesn't belong here
  return null;
}

export function AuthGuard({
  children, audience, loginPath,
}: {
  children: React.ReactNode;
  audience: Audience;
  loginPath: string;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [revalidating, setRevalidating] = useState(false);

  const liveTarget = status === "loading" ? null : redirectTarget(session ?? null, audience, loginPath);

  // Reactive: redirect as soon as the live (in-memory) session is invalid.
  useEffect(() => {
    if (liveTarget) router.replace(liveTarget);
  }, [liveTarget, router]);

  // bfcache restore / tab refocus: a restored snapshot can still look authenticated,
  // so re-check against the server (reads the real cookie) and redirect if needed.
  useEffect(() => {
    let cancelled = false;
    async function check(blankFirst: boolean) {
      if (blankFirst) setRevalidating(true);
      const s = await getSession();
      if (cancelled) return;
      const target = redirectTarget(s ?? null, audience, loginPath);
      if (target) router.replace(target);
      else setRevalidating(false);
    }
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) check(true); };
    const onVisible = () => { if (document.visibilityState === "visible") check(false); };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, audience, loginPath]);

  // Never paint protected content while we know (or are confirming) it's invalid.
  if (revalidating || liveTarget) return null;
  return <>{children}</>;
}
