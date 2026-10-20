import * as React from "react"
import { cn } from "@/lib/utils"

type SelectItemProps = React.OptionHTMLAttributes<HTMLOptionElement> & {
  value: string
  children?: React.ReactNode
}

const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  ({ className, children, ...props }, ref) => (
    <option ref={ref} {...props}>
      {children}
    </option>
  )
)
SelectItem.displayName = "SelectItem"

const SelectValue = ({
  placeholder,
  children,
}: {
  placeholder?: React.ReactNode
  children?: React.ReactNode
}) => <span className="block truncate">{children ?? placeholder ?? ""}</span>

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode
  selectedLabel?: React.ReactNode
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, selectedLabel, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      className={cn(
        "pointer-events-none flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        if (child.type !== SelectValue) return child
        const childProps = child.props as {
          children?: React.ReactNode
          placeholder?: React.ReactNode
        }
        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          {
            children:
              selectedLabel ?? childProps.children ?? childProps.placeholder ?? "",
          }
        )
      })}
    </button>
  )
)
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = ({ children }: { children?: React.ReactNode }) => children

function findSelectedLabel(
  children: React.ReactNode,
  value: string | undefined
): React.ReactNode | undefined {
  if (value === undefined || value === "") return undefined
  let label: React.ReactNode | undefined
  React.Children.forEach(children, (child) => {
    if (label !== undefined) return
    if (!React.isValidElement(child)) return
    if (child.type !== SelectItem) return
    const props = child.props as SelectItemProps
    if (props.value === value) {
      label = props.children
    }
  })
  return label
}

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
    (c): c is React.ReactElement<SelectTriggerProps> =>
      React.isValidElement(c) && c.type === SelectTrigger
  )
  const contentChild = childArray.find(
    (c): c is React.ReactElement<{ children?: React.ReactNode }> =>
      React.isValidElement(c) && c.type === SelectContent
  )

  const triggerProps = triggerChild?.props ?? {}
  const selectedLabel = findSelectedLabel(contentChild?.props?.children, value)
  const {
    id: triggerId,
    name: triggerName,
    "aria-label": triggerAriaLabel,
    "aria-describedby": triggerAriaDescribedBy,
    ...restTriggerProps
  } = triggerProps

  return (
    <div className="relative inline-block w-full rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
      {triggerChild &&
        React.cloneElement(triggerChild, {
          ...restTriggerProps,
          id: undefined,
          disabled,
          selectedLabel,
        })}
      <select
        id={triggerId}
        name={triggerName}
        aria-label={triggerAriaLabel}
        aria-describedby={triggerAriaDescribedBy}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
      >
        {contentChild &&
          React.Children.map(contentChild.props.children, (item: React.ReactNode) => item)}
      </select>
    </div>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
