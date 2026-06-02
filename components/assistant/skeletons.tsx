"use client";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder thread shown while a saved conversation is loading. */
export function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2.5">
        <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
        <div className="flex flex-col gap-2 w-full max-w-[420px]">
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-56 rounded-2xl" />
      </div>
      <div className="flex gap-2.5">
        <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
        <div className="flex flex-col gap-2 w-full max-w-[360px]">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
    </div>
  );
}

/** Placeholder rows shown while the conversation list is loading. */
export function ConversationListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-3.5 py-2.5 flex flex-col gap-1.5">
          <Skeleton className="h-3" style={{ width: `${55 + ((i * 11) % 35)}%` }} />
          <Skeleton className="h-2 w-10" />
        </div>
      ))}
    </div>
  );
}
