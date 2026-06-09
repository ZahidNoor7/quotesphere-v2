"use client";
import { Input } from "@/components/ui/input";
import { fromMinor, toMinor } from "@/lib/payroll/money";

/**
 * Money input that displays MAJOR units (what the admin types) but reports integer
 * MINOR units (what payroll stores). Keeps the minor-unit convention out of the UI
 * code at call sites.
 */
export function MoneyInput({
  valueMinor,
  onChangeMinor,
  placeholder,
  disabled,
  autoFocus,
}: {
  valueMinor: number;
  onChangeMinor: (minor: number) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      placeholder={placeholder ?? "0.00"}
      disabled={disabled}
      autoFocus={autoFocus}
      value={Number.isFinite(valueMinor) ? fromMinor(valueMinor) : ""}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        onChangeMinor(Number.isNaN(n) ? 0 : toMinor(n));
      }}
    />
  );
}
