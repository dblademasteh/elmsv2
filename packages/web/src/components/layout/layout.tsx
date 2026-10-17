"use client"

import { useEffect, useState } from "react"

export function Layout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>{children}</main>
    </div>
  )
}

export default Layout
