"use client";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows shown while the conversation list is loading. */
export function MessagingListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="px-3.5 py-3 flex items-center gap-3">
          <Skeleton className="h-[38px] w-[38px] rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3" style={{ width: `${45 + ((i * 13) % 35)}%` }} />
              <Skeleton className="h-2 w-6 shrink-0" />
            </div>
            <Skeleton className="h-2.5" style={{ width: `${58 + ((i * 7) % 30)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder thread shown while a conversation's messages are loading. */
export function MessageThreadSkeleton() {
  // Alternating in/out bubbles of varied size for a natural-looking thread.
  const rows = [
    { side: "in", w: 200, h: 34 },
    { side: "out", w: 150, h: 34 },
    { side: "in", w: 240, h: 52 },
    { side: "out", w: 110, h: 34 },
    { side: "in", w: 170, h: 34 },
    { side: "out", w: 210, h: 52 },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={i} className={`flex ${r.side === "out" ? "justify-end" : "justify-start"}`}>
          <Skeleton
            style={{
              width: r.w,
              height: r.h,
              maxWidth: "72%",
              borderRadius: r.side === "out" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            }}
          />
        </div>
      ))}
    </div>
  );
}
