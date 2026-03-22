import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer border-none outline-none",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] text-white shadow-[0_2px_12px_var(--accent-glow),0_0_0_1px_rgba(255,255,255,0.12)_inset] hover:shadow-[0_4px_20px_var(--accent-glow)] hover:-translate-y-px",
        destructive: "bg-[rgba(248,113,113,0.15)] text-[#f87171] border border-[rgba(248,113,113,0.3)] hover:bg-[rgba(248,113,113,0.25)]",
        outline: "bg-[rgba(255,255,255,0.055)] text-[rgba(210,216,255,0.72)] border-[0.5px] border-[rgba(255,255,255,0.11)] hover:bg-[rgba(255,255,255,0.09)] hover:text-[#eef0ff]",
        secondary: "bg-[rgba(255,255,255,0.055)] text-[rgba(210,216,255,0.72)] border-[0.5px] border-[rgba(255,255,255,0.11)] hover:bg-[rgba(255,255,255,0.09)] hover:text-[#eef0ff]",
        ghost: "text-[rgba(210,216,255,0.72)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[#eef0ff]",
        link: "text-[#818cf8] underline-offset-4 hover:underline",
        success: "bg-[rgba(52,211,153,0.15)] text-[#34d399] border-[0.5px] border-[rgba(52,211,153,0.3)] hover:bg-[rgba(52,211,153,0.25)]",
        warning: "bg-[rgba(251,191,36,0.15)] text-[#fbbf24] border-[0.5px] border-[rgba(251,191,36,0.3)] hover:bg-[rgba(251,191,36,0.25)]",
      },
      size: {
        default: "h-[30px] px-[14px] text-[12px] rounded-[100px]",
        sm: "h-[26px] px-[11px] text-[11px] rounded-[100px]",
        lg: "h-[38px] px-[20px] text-[13px] rounded-[100px]",
        icon: "h-[30px] w-[30px] rounded-[100px]",
        "icon-sm": "h-[26px] w-[26px] rounded-[8px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<any>;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size }), child.props.className, className),
      });
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
