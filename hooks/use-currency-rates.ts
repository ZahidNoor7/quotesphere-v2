"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { CurrencyRates } from "@/types";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => d.data as CurrencyRates);

export interface UseCurrencyRatesReturn {
  rates: Record<string, number>;
  thresholds: Record<string, number>;
  lastUpdated: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  sync: () => Promise<void>;
  updateThreshold: (currency: string, multiplier: number) => Promise<void>;
  getEffectiveRate: (currency: string) => number;
  getSnapshot: () => Record<string, number>;
}

export function useCurrencyRates(defaultCurrency: string = "PKR"): UseCurrencyRatesReturn {
  const swrKey = `/api/settings/currency-rates?base=${defaultCurrency}`;

  const { data, mutate, isLoading } = useSWR<CurrencyRates>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const [isSyncing, setIsSyncing] = useState(false);

  async function sync() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/settings/currency-rates", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Sync failed");
      await mutate(json.data as CurrencyRates, false);
      toast.success("Exchange rates synced successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to sync rates");
    } finally {
      setIsSyncing(false);
    }
  }

  async function updateThreshold(currency: string, multiplier: number) {
    // Optimistic update
    if (data) {
      mutate(
        { ...data, thresholds: { ...data.thresholds, [currency]: multiplier } },
        false
      );
    }
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currencyRates: { thresholds: { [currency]: multiplier } },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    } catch (err: any) {
      toast.error(`Failed to save threshold for ${currency}`);
      mutate(); // revert on failure
    }
  }

  function getEffectiveRate(currency: string): number {
    const marketRate = data?.rates?.[currency] ?? 0;
    const multiplier = data?.thresholds?.[currency] ?? 1.0;
    return marketRate * multiplier;
  }

  /** Returns current rates snapshot for saving alongside a new document. */
  function getSnapshot(): Record<string, number> {
    return data?.rates ?? {};
  }

  return {
    rates: data?.rates ?? {},
    thresholds: data?.thresholds ?? {},
    lastUpdated: data?.lastUpdated ?? null,
    isLoading,
    isSyncing,
    sync,
    updateThreshold,
    getEffectiveRate,
    getSnapshot,
  };
}
