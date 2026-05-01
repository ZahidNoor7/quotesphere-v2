"use client";
import type { LucideIcon } from "lucide-react";
import { T1, T2, T3, AC, ICON_PILL } from "@/lib/ds";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 gap-3 ${className ?? ""}`}
      aria-label={`Empty: ${title}`}
    >
      <div
        style={{
          ...ICON_PILL,
          width: 52,
          height: 52,
          borderRadius: "50%",
          cursor: "default",
        }}
      >
        <Icon className="w-6 h-6" style={{ color: AC }} />
      </div>
      <h3 style={{ color: T1 }} className="font-semibold text-base">
        {title}
      </h3>
      {description && (
        <p style={{ color: T3 }} className="text-sm text-center max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
