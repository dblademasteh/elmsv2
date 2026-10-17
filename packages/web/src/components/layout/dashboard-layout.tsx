'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { AppBar } from "@/components/layout/appbar"
import { useAuthStore } from "@/store/auth"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, token } = useAuthStore()
  const router = useRouter()

  useEffect(() => setMounted(true), [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (mounted && !token) {
      router.push("/login")
    }
  }, [mounted, token, router])

  if (!mounted || !token) {
    return null
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar - always visible on desktop, toggleable on mobile */}
      <div className={`fixed inset-y-0 left-0 z-40 transform -translate-x-full lg:translate-x-0 lg:static lg:block transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-auto">
        <AppBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
