"use client";
import useSWR from "swr";
import type { Settings, AppearanceSettings, LastUsedSettings } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

export function useSettings() {
  const { data, mutate, isLoading } = useSWR<Settings>("/api/settings", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  async function patch(updates: Record<string, any>) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      mutate();
    } catch {
      // background save — ignore network errors silently
    }
  }

  async function updateAppearance(updates: Partial<AppearanceSettings>) {
    mutate(
      data ? { ...data, appearance: { ...data.appearance, ...updates } } : data,
      false
    );
    await patch({ appearance: updates });
  }

  async function updateLastUsed(updates: Partial<LastUsedSettings>) {
    mutate(
      data ? { ...data, lastUsed: { ...data.lastUsed, ...updates } } : data,
      false
    );
    await patch({ lastUsed: updates });
  }

  async function updateEnabledCurrencies(currencies: string[]) {
    mutate(data ? { ...data, enabledCurrencies: currencies } : data, false);
    await patch({ enabledCurrencies: currencies });
  }

  async function updateDefaultCurrency(currency: string) {
    mutate(data ? { ...data, default_currency: currency } : data, false);
    await patch({ default_currency: currency });
  }

  return {
    settings: data,
    isLoading,
    mutate,
    updateAppearance,
    updateLastUsed,
    updateEnabledCurrencies,
    updateDefaultCurrency,
  };
}
