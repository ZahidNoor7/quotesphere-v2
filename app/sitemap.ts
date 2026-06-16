import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/assistant/base-url";

// Served at /sitemap.xml (allow-listed as public in auth.config.ts). The landing
// page is a single anchored route, so `/` is the only public URL to list.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  return [
    {
      url: base,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
