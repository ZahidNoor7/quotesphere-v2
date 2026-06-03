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
  serverExternalPackages: ["cloudinary", "puppeteer-core", "@sparticuz/chromium-min"],
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
    ];
  },
};

export default nextConfig;
