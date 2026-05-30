"use client";
import { useState } from "react";
import { useCurrencyRates } from "@/hooks/use-currency-rates";
import { useSettings } from "@/hooks/use-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Spinner, SpinnerCenter } from "@/components/loaders/spinner";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const QUICK_MULTIPLIERS = [0.5, 1, 1.5, 2, 3, 5, 10];

const CURRENCY_META: Record<string, { name: string; symbol: string; flag: string }> = {
  PKR: { name: "Pakistani Rupee", symbol: "₨", flag: "🇵🇰" },
  USD: { name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  EUR: { name: "Euro", symbol: "€", flag: "🇪🇺" },
  GBP: { name: "British Pound", symbol: "£", flag: "🇬🇧" },
  AED: { name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  SAR: { name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
};

const ALL_CURRENCIES = Object.keys(CURRENCY_META);

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CurrencyRow({
  currency,
  base,
  isDefault,
  isEnabled,
  canDisable,
  marketRate,
  threshold,
  effectiveRate,
  isLoadingRates,
  isMobile,
  onToggle,
  onThresholdChange,
}: {
  currency: string;
  base: string;
  isDefault: boolean;
  isEnabled: boolean;
  canDisable: boolean;
  marketRate: number | null;
  threshold: number;
  effectiveRate: number;
  isLoadingRates: boolean;
  isMobile: boolean;
  onToggle: () => void;
  onThresholdChange: (v: number) => void;
}) {
  const meta = CURRENCY_META[currency];
  const pctDiff = (threshold - 1) * 100;
  const isMarkup = threshold > 1;
  const [inputVal, setInputVal] = useState(String(threshold));

  // Keep input in sync when threshold changes externally
  const rounded = Math.round(threshold * 1000) / 1000;
  const inputRounded = Math.round(parseFloat(inputVal) * 1000) / 1000;
  if (!isNaN(inputRounded) && inputRounded !== rounded) {
    // only sync if not actively typing (value is stable)
  }

  const isBase = currency === base;

  return (
    <div
      style={{
        padding: "12px 14px",
        background: isEnabled ? "var(--glass)" : "transparent",
        transition: "background 0.15s",
        opacity: isEnabled ? 1 : 0.55,
      }}
    >
      {/* Main row: flag+name | rate | toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Flag + code + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.flag}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{currency}</span>
              {isDefault && (
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 100,
                  background: "rgba(99,102,241,0.18)", color: "#818cf8",
                  border: "0.5px solid rgba(99,102,241,0.35)", fontWeight: 600,
                }}>
                  DEFAULT
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: T3 }}>{meta.name}</div>
          </div>
        </div>

        {/* Rate pill */}
        <div style={{
          fontSize: 11, color: T2,
          background: "var(--glass)",
          border: `0.5px solid ${GLASS_BORDER}`,
          borderRadius: 100, padding: "3px 10px",
          flexShrink: 0,
        }}>
          {isBase ? (
            <span style={{ color: T3 }}>Base currency</span>
          ) : isLoadingRates ? (
            <span style={{ color: T3 }}>Loading…</span>
          ) : marketRate === null ? (
            <span style={{ color: T3 }}>No rate</span>
          ) : (
            <>
              <span style={{ color: T3 }}>1 {base} = </span>
              <span style={{ color: T1, fontWeight: 600 }}>{marketRate.toFixed(4)} {currency}</span>
            </>
          )}
        </div>

        {/* Toggle */}
        <div
          onClick={() => { if (isBase || !canDisable && isEnabled) return; onToggle(); }}
          title={isBase ? "Base currency cannot be toggled" : !canDisable && isEnabled ? "At least one currency must remain enabled" : ""}
          style={{
            width: 34, height: 19, borderRadius: 100,
            background: isEnabled ? "var(--accent)" : "var(--glass-border-strong)",
            position: "relative",
            cursor: isBase || (!canDisable && isEnabled) ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            flexShrink: 0,
            opacity: isBase ? 0.4 : 1,
          }}
        >
          <div style={{
            width: 15, height: 15, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 2, left: isEnabled ? 17 : 2,
            transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }} />
        </div>
      </div>

      {/* Threshold row — only for non-base, enabled currencies with a rate */}
      {!isBase && isEnabled && marketRate !== null && !isLoadingRates && (
        <div style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          marginTop: 9, paddingTop: 9,
          borderTop: `0.5px solid ${GLASS_BORDER}`,
          gap: isMobile ? 8 : 12,
        }}>
          {/* Multiplier chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 10, color: T3, marginRight: 2, whiteSpace: "nowrap" as const }}>Markup:</span>
            {QUICK_MULTIPLIERS.map((m) => {
              const isActive = Math.abs(threshold - m) < 0.001;
              return (
                <button
                  key={m}
                  onClick={() => { onThresholdChange(m); setInputVal(String(m)); }}
                  style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 100,
                    border: `0.5px solid ${isActive ? "rgba(99,102,241,0.6)" : GLASS_BORDER}`,
                    background: isActive ? "rgba(99,102,241,0.2)" : "var(--glass)",
                    color: isActive ? "#818cf8" : T3,
                    cursor: "pointer", fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {m}x
                </button>
              );
            })}
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) onThresholdChange(v);
              }}
              onBlur={() => {
                const v = parseFloat(inputVal);
                setInputVal(isNaN(v) || v <= 0 ? String(threshold) : String(v));
              }}
              placeholder="custom"
              style={{ width: 58, padding: "2px 7px", fontSize: 10 }}
            />
          </div>

          {/* Effective rate */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: T3 }}>Effective:</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T1 }}>
              {effectiveRate.toFixed(4)} {currency}
            </span>
            {threshold !== 1 && (
              <span style={{
                fontSize: 9.5, padding: "1px 6px", borderRadius: 100, fontWeight: 600,
                background: isMarkup ? "rgba(251,191,36,0.12)" : "rgba(52,211,153,0.12)",
                color: isMarkup ? "#fbbf24" : "#34d399",
                border: `0.5px solid ${isMarkup ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.3)"}`,
              }}>
                {isMarkup ? "+" : ""}{pctDiff.toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CurrencyRatesPanel() {
  const isMobile = useIsMobile();
  const {
    settings,
    updateEnabledCurrencies,
    updateDefaultCurrency,
  } = useSettings();

  const defaultCurrency = settings?.default_currency ?? "PKR";
  const enabledCurrencies = settings?.enabledCurrencies ?? ["PKR"];

  const {
    rates, thresholds, lastUpdated,
    isLoading: isLoadingRates, isSyncing,
    sync, updateThreshold, getEffectiveRate,
  } = useCurrencyRates(defaultCurrency);
  const lastSyncedLabel = lastUpdated
    ? `Last synced ${formatRelativeTime(lastUpdated)}`
    : "Never synced";

  function toggleCurrency(code: string) {
    if (code === defaultCurrency) return; // default can't be toggled off
    const isEnabled = enabledCurrencies.includes(code);
    if (isEnabled && enabledCurrencies.length <= 1) return;
    updateEnabledCurrencies(
      isEnabled ? enabledCurrencies.filter(c => c !== code) : [...enabledCurrencies, code]
    );
  }

  return (
    <div>
      {/* Section header */}
      <div style={{ fontSize: 14, fontWeight: 500, color: T1, marginBottom: 16 }}>Currencies</div>

      {/* Default currency select + sync button */}
      <div className="CurrencySelector" style={{
        display: "flex",
        // flexDirection: isMobile ? "column" : "row",
        // flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: isMobile ? 10 : 12, marginBottom: 14,
      }}>
        <div style={{ display: "flex", flexDirection: 'column', alignItems: "start", gap: 10 }}>
          <span style={{ fontSize: 11, color: T3, whiteSpace: "nowrap" as const }}>Default currency:</span>
          <Select
            value={defaultCurrency}
            onValueChange={(code) => {
              updateDefaultCurrency(code);
              if (!enabledCurrencies.includes(code)) {
                updateEnabledCurrencies([...enabledCurrencies, code]);
              }
            }}
          >
            <SelectTrigger className="h-7 w-auto gap-2 border-[0.5px] border-white/15 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10 focus:ring-0 focus:ring-offset-0 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/15 bg-[#1a1a2e]">
              {ALL_CURRENCIES.map(c => (
                <SelectItem key={c} value={c} className="cursor-pointer text-xs text-white/80 focus:bg-white/10 focus:text-white">
                  <span className="flex items-center gap-1.5">
                    <span>{CURRENCY_META[c].flag}</span>
                    <span className="font-semibold">{c}</span>
                    <span className="text-white/50">— {CURRENCY_META[c].name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sync button + last synced */}
        <div style={{ display: "flex", flexDirection: 'column', alignItems: "start", gap: 10 }}>
          <span style={{ fontSize: 10, color: T3 }}>
            {isLoadingRates ? "Fetching…" : lastSyncedLabel}
          </span>
          <button
            onClick={sync}
            disabled={isSyncing || isLoadingRates}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 7,
              border: `0.5px solid ${GLASS_BORDER}`,
              background: GLASS, color: T2, fontSize: 11,
              cursor: isSyncing || isLoadingRates ? "not-allowed" : "pointer",
              opacity: isSyncing || isLoadingRates ? 0.6 : 1,
            }}
          >
            {isSyncing ? <Spinner size="sm" /> : <RefreshCw size={11} />}
            {isSyncing ? "Syncing…" : "Sync rates"}
          </button>
        </div>
      </div>

      {/* Info notice */}
      <div style={{
        fontSize: 11, color: T3, padding: "6px 10px", borderRadius: 8,
        background: "rgba(99,102,241,0.07)", border: "0.5px solid rgba(99,102,241,0.18)",
        marginBottom: 12,
      }}>
        Toggle currencies on/off for use in documents. Set a markup multiplier per currency for price conversions. Rates auto-refresh daily.
      </div>

      {/* Currency list */}
      <div style={{ borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
        {isLoadingRates ? (
          <SpinnerCenter height={120} />
        ) : (
          ALL_CURRENCIES.map((currency, i) => {
            const isDefault = currency === defaultCurrency;
            const isEnabled = enabledCurrencies.includes(currency) || isDefault;
            const marketRate = currency === defaultCurrency ? null : (rates[currency] ?? null);
            const threshold = thresholds[currency] ?? 1.0;
            const effectiveRate = getEffectiveRate(currency);
            const isLast = i === ALL_CURRENCIES.length - 1;

            return (
              <div
                key={currency}
                style={{ borderBottom: isLast ? "none" : `0.5px solid ${GLASS_BORDER}` }}
              >
                <CurrencyRow
                  currency={currency}
                  base={defaultCurrency}
                  isDefault={isDefault}
                  isEnabled={isEnabled}
                  canDisable={enabledCurrencies.length > 1}
                  marketRate={marketRate}
                  threshold={threshold}
                  effectiveRate={effectiveRate}
                  isLoadingRates={false}
                  isMobile={isMobile}
                  onToggle={() => toggleCurrency(currency)}
                  onThresholdChange={(v) => updateThreshold(currency, v)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
