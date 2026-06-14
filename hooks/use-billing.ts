"use client";
import useSWR from "swr";
import type { TenantBillingView } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data);

/** Tenant billing/plan view for the Settings → Plan page. */
export function useBilling() {
  const { data, isLoading, mutate } = useSWR<TenantBillingView>("/api/billing", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 8000,
  });
  return { billing: data, isLoading, mutate };
}
