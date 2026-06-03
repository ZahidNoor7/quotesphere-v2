// Resolve the app's own origin so the assistant's tool executor can call
// quotesphere's existing API routes server-to-server (forwarding the user's
// session cookie).
//
// Prefer the ACTUAL origin the request arrived on (host / x-forwarded-host) so
// self-calls always hit the same server — robust to non-default dev ports
// (e.g. when 3000 is taken and Next starts on 3001) and to whatever host the
// app is deployed under. Fall back to the env ladder only when no request is
// available (cron jobs, scripts).
export function getBaseUrl(req?: Request): string {
  const h = req?.headers;
  const host = h?.get("x-forwarded-host") ?? h?.get("host") ?? null;
  if (host) {
    const proto = h?.get("x-forwarded-proto") ?? (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return (
    process.env.PDF_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}
