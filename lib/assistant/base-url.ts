// Resolve the app's own origin so the assistant's tool executor can call
// quotesphere's existing API routes server-to-server (forwarding the user's
// session cookie). Mirrors the base-URL ladder used by app/api/pdf/[type]/[id].
export function getBaseUrl(): string {
  return (
    process.env.PDF_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}
