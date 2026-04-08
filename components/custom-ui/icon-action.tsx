import { cn } from "@/lib/utils";
import { ICON_PILL } from "@/lib/ds";

interface IconActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "danger" adds a red hover glow; "default" uses the standard glass hover */
  variant?: "default" | "danger";
  /** Tooltip shown on hover via the title attribute */
  tooltip?: string;
}

/**
 * Small pill icon button.
 *
 * Replaces the repeated `style={ICON_PILL}` + `onMouseEnter/Leave` inline
 * pattern found across invoices, customers, quotations, and other list pages.
 *
 * Hover states are handled purely by CSS (.icon-action, .icon-action-danger)
 * defined in globals.css — no JS style manipulation needed.
 *
 * Usage:
 *   <IconAction tooltip="Edit" onClick={...}>
 *     <EditIcon />
 *   </IconAction>
 *   <IconAction variant="danger" tooltip="Delete" onClick={...}>
 *     <TrashIcon />
 *   </IconAction>
 */
export function IconAction({
  variant = "default",
  tooltip,
  className,
  children,
  style,
  ...props
}: IconActionProps) {
  return (
    <button
      title={tooltip}
      className={cn(
        "icon-action",
        variant === "danger" && "icon-action-danger",
        className
      )}
      style={{ ...ICON_PILL, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
