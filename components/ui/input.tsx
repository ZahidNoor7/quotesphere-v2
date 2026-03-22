import * as React from "react";
import { cn } from "@/lib/utils";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

const inputStyle = {
  background: "var(--glass)",
  border: "0.5px solid var(--glass-border)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "var(--t1)",
  fontSize: 12,
  outline: "none",
  width: "100%",
  transition: "border-color 0.15s, background 0.15s",
} as const;

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, style, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("field-input", className)}
      style={{ ...inputStyle, ...style }}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({ className, children, style, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      style={{ fontSize: 10.5, color: "var(--t3)", fontWeight: 500, ...style }}
      className={className}
      {...props}
    >{children}</label>
  );
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, style, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("field-input resize-none", className)}
      style={{ ...inputStyle, borderRadius: 8, ...style }}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Field({
  label, children, className, error,
}: { label?: string; children: React.ReactNode; className?: string; error?: string }) {
  return (
    <div className={cn("flex flex-col gap-[3px]", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error && <p style={{ fontSize: 10, color: "#f87171" }}>{error}</p>}
    </div>
  );
}

/* ── Select ── */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    style={{
      ...inputStyle,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      height: 34,
      padding: "0 10px",
    }}
    className={cn("[&>span]:line-clamp-1", className)}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      style={{
        background: "var(--modal-bg)",
        border: "0.5px solid var(--glass-border)",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        overflow: "hidden",
        zIndex: 100,
      }}
      position={position}
      className={cn("animate-in fade-in-0 zoom-in-95", position === "popper" && "data-[side=bottom]:translate-y-1", className)}
      {...props}
    >
      <SelectPrimitive.Viewport style={{ padding: 4 }}>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    style={{ fontSize: 12, color: "var(--t2)", borderRadius: 7, padding: "7px 10px 7px 10px", cursor: "pointer", position: "relative", outline: "none" }}
    className={cn("flex w-full select-none items-center pr-8 focus:bg-white/[0.07] focus:text-[var(--t1)] hover:bg-white/[0.07] hover:text-[var(--t1)] data-[disabled]:opacity-50", className)}
    {...props}
  >
    <span style={{ position: "absolute", right: 8 }}>
      <SelectPrimitive.ItemIndicator>
        <Check style={{ width: 14, height: 14, color: "var(--accent2)" }} />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
