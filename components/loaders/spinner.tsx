import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "w-4 h-4 border",
  md: "w-6 h-6 border-2",
  lg: "w-7 h-7 border-2",
};

/**
 * Reusable spinner – replaces all inline `@keyframes spin` / `borderTopColor` patterns
 * that were copy-pasted across invoices, customers, and other list pages.
 * Uses Tailwind's built-in `animate-spin`; border accent color follows the active theme.
 */
export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn("rounded-full animate-spin", SIZES[size], className)}
      style={{
        borderColor: "rgba(99,102,241,0.25)",
        borderTopColor: "var(--accent)",
      }}
    />
  );
}

/**
 * Centered spinner inside a fixed-height container.
 * Used as the inline loading state for tables and cards while SWR fetches.
 */
export function SpinnerCenter({ height = 200 }: { height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height,
      }}
    >
      <Spinner />
    </div>
  );
}
