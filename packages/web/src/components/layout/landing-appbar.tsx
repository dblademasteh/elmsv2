'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"

const navigation = [
  { name: "Courses", href: "/courses" },
  { name: "About", href: "#features" },
  { name: "Testimonials", href: "#testimonials" },
]

export function LandingAppBar() {
  const pathname = usePathname()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Only render on the landing page
  if (pathname !== "/") return null

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>Learn.</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop Auth / Actions */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated() && user ? (
            <>
              <span className="text-sm text-muted-foreground">
                Hi, {user.full_name.split(" ")[0]}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-sm font-medium"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild className="text-sm font-medium">
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="text-sm font-semibold">
                <Link href="/register">
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden animate-in slide-in-from-top duration-200"
        >
          <div className="flex flex-col gap-2 px-4 py-4 sm:px-6 lg:px-8 border-t border-border">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-2 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-2">
              {isAuthenticated() && user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full justify-start text-sm font-medium"
                >
                  Sign Out
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="ghost" asChild className="justify-start text-sm font-medium">
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      Log in
                    </Link>
                  </Button>
                  <Button size="sm" asChild className="text-sm font-semibold">
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      Sign up
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
