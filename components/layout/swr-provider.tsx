"use client";
import { SWRConfig, type SWRConfiguration } from "swr";

const swrConfig: SWRConfiguration = {
  fetcher: async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  },
  revalidateOnFocus: false,
  dedupingInterval: 5000,
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
