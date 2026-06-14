"use client";
import useSWR from "swr";
import type { Entitlements, FeatureKey } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data);

/**
 * Tenant-side entitlements (status + feature set). Drives the sidebar locks,
 * module guards and banners. Client UX only — the security boundary is the
 * server (app layout block + withTenant write-gate).
 */
export function useEntitlements() {
  const { data, isLoading, mutate } = useSWR<Entitlements>("/api/entitlements", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20000,
  });
  return {
    entitlements: data,
    isLoading,
    mutate,
    hasFeature: (key: FeatureKey) => !!data?.features?.includes(key),
  };
}
