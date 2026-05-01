"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T1, T2, T3, CARD, AC } from "@/lib/ds";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message = "Something went wrong.", onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 gap-4 ${className ?? ""}`}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(239,68,68,0.12)",
          border: "0.5px solid rgba(239,68,68,0.3)",
        }}
      >
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p style={{ color: T1 }} className="font-medium text-sm">
          Failed to load data
        </p>
        <p style={{ color: T3 }} className="text-xs text-center max-w-xs">
          {message}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
          aria-label="Retry loading data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
