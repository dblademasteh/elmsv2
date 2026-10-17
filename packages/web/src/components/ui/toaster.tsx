"use client"

import { ToastAction, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  )
}
