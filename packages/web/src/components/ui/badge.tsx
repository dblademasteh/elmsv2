import * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "text-foreground border border-border",
  destructive: "bg-destructive text-destructive-foreground",
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof badgeVariants
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeVariants[variant],
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Badge.displayName = "Badge"

export { Badge }
