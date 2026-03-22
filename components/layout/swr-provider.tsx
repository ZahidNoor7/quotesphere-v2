"use client";
import { SWRConfig } from "swr";

const swrConfig = {
  fetcher: (url: string) => fetch(url).then(r => r.json()),
  revalidateOnFocus: false,
  dedupingInterval: 5000,
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
