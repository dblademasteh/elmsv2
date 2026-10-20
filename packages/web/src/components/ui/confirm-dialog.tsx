"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useConfirmStore } from "@/store/confirm"

/**
 * The confirmation dialog driven by `confirmAction()`.
 *
 * Mounted once in the root layout, so every page can ask for a confirmation
 * without owning the state for it.
 */
export function ConfirmDialog() {
  const options = useConfirmStore((state) => state.options)
  const answer = useConfirmStore((state) => state.answer)

  if (!options) return null

  const confirmLabel = options.confirmLabel ?? "Confirm"
  const cancelLabel = options.cancelLabel ?? "Cancel"

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Closing the dialog in any way is a cancellation.
        if (!open) answer(false)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => answer(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={options.destructive ? "destructive" : "default"}
            onClick={() => answer(true)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
