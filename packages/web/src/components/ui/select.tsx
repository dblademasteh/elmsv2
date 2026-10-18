import * as React from "react"
import { cn } from "@/lib/utils"

// Simple Select component using native HTML elements
const Select = ({
  value,
  onValueChange,
  disabled,
  children,
}: {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}) => {
  const childArray = React.Children.toArray(children)
  const triggerChild = childArray.find(
    (c: any) => c.type === SelectTrigger
  ) as React.ReactElement | undefined
  const contentChild = childArray.find(
    (c: any) => c.type === SelectContent
  ) as React.ReactElement | undefined

  return (
    <div className="relative inline-block w-full">
      {triggerChild &&
        React.cloneElement(triggerChild, {
          children: triggerChild.props.children,
        })}
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: 1 }}
      >
        {contentChild &&
          React.Children.map(contentChild.props.children, (item: any) => {
            if (item.type === SelectItem) {
              return React.cloneElement(item, {
                style: { display: "block" },
              })
            }
            return item
          })}
      </select>
    </div>
  )
}

const SelectTrigger = React.forwardRef<HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
>(({ className, children }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus-within:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    type="button"
  >
    {children}
  </button>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span className="block truncate">{placeholder || ""}</span>
)

const SelectContent = ({ children }: { children: React.ReactNode }) => children

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement> & { value: string; children: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <option ref={ref} {...props}>{children}</option>
))
SelectItem.displayName = "SelectItem"

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
