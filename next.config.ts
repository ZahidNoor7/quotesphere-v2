import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ship the help-center markdown with the serverless functions that read it.
  outputFileTracingIncludes: {
    "/docs/[[...slug]]": ["./content/docs/**/*"],
    "/docs": ["./content/docs/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  serverExternalPackages: ["cloudinary", "puppeteer-core", "@sparticuz/chromium-min", "isomorphic-dompurify"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Allow the proxy middleware to forward up to 25 MB so /api/upload receives full file bodies
    proxyClientMaxBodySize: 26_214_400,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Request the browser's colour-scheme preference as a Client Hint.
          // Accept-CH makes the browser send it on the *next* request.
          // Critical-CH makes it retry the *current* request immediately if absent
          // — eliminating the first-visit flash for browsers that support it
          // (Chrome 98+, Edge 98+).
          { key: "Accept-CH",   value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Critical-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Vary",        value: "Sec-CH-Prefers-Color-Scheme" },
        ],
      },
      {
        // Make page documents bfcache-INELIGIBLE so back/forward after logout does a
        // fresh load (server/edge guard redirects) instead of repainting a frozen
        // authenticated snapshot. Excludes API + static assets. Only affects
        // cross-document navigations — in-app SPA routing is unchanged.
        source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
