import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        background: "var(--glass)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "0.5px solid var(--glass-border)",
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
      }}
      className={className}
      {...props}
    >
      {/* Specular highlight */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)",
        pointerEvents: "none", zIndex: 0, borderRadius: "inherit",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pb-3", className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}
      className={className}
      {...props}
    >{children}</h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p style={{ fontSize: 11, color: "var(--t3)" }} className={className} {...props}>{children}</p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props}>{children}</div>;
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-4 pt-0", className)} {...props}>{children}</div>;
}

/* ── Badge ── */
const badgeVariants = cva(
  "inline-flex items-center rounded-[100px] font-medium",
  {
    variants: {
      variant: {
        default: "bg-[rgba(99,102,241,0.2)] text-[var(--accent2)] border border-[rgba(99,102,241,0.3)] px-[9px] py-[3px] text-[10.5px]",
        secondary: "bg-[rgba(180,190,255,0.08)] text-[rgba(180,190,255,0.55)] border border-[rgba(180,190,255,0.12)] px-[9px] py-[3px] text-[10.5px]",
        destructive: "bg-[rgba(248,113,113,0.15)] text-[#fca5a5] border border-[rgba(248,113,113,0.25)] px-[9px] py-[3px] text-[10.5px]",
        outline: "bg-transparent border border-[var(--glass-border)] text-[var(--t2)] px-[9px] py-[3px] text-[10.5px]",
        success: "bg-[rgba(52,211,153,0.15)] text-[#6ee7b7] border border-[rgba(52,211,153,0.25)] px-[9px] py-[3px] text-[10.5px]",
        warning: "bg-[rgba(251,191,36,0.15)] text-[#fcd34d] border border-[rgba(251,191,36,0.25)] px-[9px] py-[3px] text-[10.5px]",
        info: "bg-[rgba(96,165,250,0.15)] text-[#93c5fd] border border-[rgba(96,165,250,0.25)] px-[9px] py-[3px] text-[10.5px]",
        purple: "bg-[rgba(167,139,250,0.15)] text-[#c4b5fd] border border-[rgba(167,139,250,0.25)] px-[9px] py-[3px] text-[10.5px]",
        teal: "bg-[rgba(45,212,191,0.15)] text-[#5eead4] border border-[rgba(45,212,191,0.25)] px-[9px] py-[3px] text-[10.5px]",
        muted: "bg-[rgba(180,190,255,0.07)] text-[var(--t3)] border border-[rgba(180,190,255,0.1)] px-[9px] py-[3px] text-[10.5px]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({ className, variant, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props}>{children}</span>;
}

export function Separator({ className, orientation = "horizontal", ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      style={{ background: "var(--glass-border)" }}
      className={cn(orientation === "horizontal" ? "h-px w-full" : "h-full w-px", "shrink-0", className)}
      {...props}
    />
  );
}

export function Avatar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative flex shrink-0 overflow-hidden rounded-full", className)} {...props}>{children}</div>;
}
export function AvatarImage({ src, alt, className }: { src?: string; alt?: string; className?: string }) {
  if (!src) return null;
  return <img src={src} alt={alt} className={cn("aspect-square h-full w-full object-cover", className)} />;
}
export function AvatarFallback({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))", fontSize: 11, fontWeight: 600, color: "#fff" }}
      className={cn("flex h-full w-full items-center justify-center rounded-full", className)}
      {...props}
    >{children}</div>
  );
}
