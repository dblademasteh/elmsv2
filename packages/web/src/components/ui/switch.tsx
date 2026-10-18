import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps
  extends React.HTMLAttributes<HTMLLabelElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

const Switch = React.forwardRef<HTMLLabelElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <label
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      ref={ref}
      {...props}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        disabled={disabled}
      />
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
          checked ? "left-4" : "left-0.5"
        )}
      />
    </label>
  )
)
Switch.displayName = "Switch"

export { Switch }
