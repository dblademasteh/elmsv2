'use client'

import * as React from "react"
import { Theme as RadixTheme } from "@radix-ui/themes"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

/**
 * Syncs Radix Themes' appearance with next-themes' resolved theme so both
 * systems (shadcn `.dark` tokens + Radix Themes) toggle together.
 */
function RadixThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()

  return (
    <RadixTheme
      appearance={resolvedTheme === "dark" ? "dark" : "light"}
      accentColor="blue"
      grayColor="slate"
      radius="medium"
      hasBackground={false}
    >
      {children}
    </RadixTheme>
  )
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <RadixTheme>{children}</RadixTheme>
    </NextThemesProvider>
  )
}
