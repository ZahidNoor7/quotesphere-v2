import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-lg border-[0.5px] border-(--glass-border) bg-(--glass) px-3 py-2 text-xs text-(--t1) outline-none transition-colors duration-150 placeholder:text-(--t3) focus:border-(--glass-border-strong) focus:bg-(--glass-hover) disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
