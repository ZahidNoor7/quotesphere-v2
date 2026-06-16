import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/assistant/base-url";

// Served at /robots.txt (allow-listed as public in auth.config.ts). Lets crawlers
// index the public landing page while keeping the authed app + APIs out of search.
export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth",
        "/platform",
        "/dashboard",
        "/invoices",
        "/quotations",
        "/expenses",
        "/projects",
        "/customers",
        "/services",
        "/products",
        "/reports",
        "/payroll",
        "/messaging",
        "/assistant",
        "/settings",
        "/print",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
