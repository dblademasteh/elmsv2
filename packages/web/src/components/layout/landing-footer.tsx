'use client'

import Link from "next/link"
import { GraduationCap } from "lucide-react"

const footerNav = [
  { name: "Courses", href: "/courses" },
  { name: "Features", href: "/#features" },
  { name: "Testimonials", href: "/#testimonials" },
  { name: "Log in", href: "/login" },
  { name: "Sign up", href: "/register" },
]

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background" role="contentinfo">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-foreground">Learn.</span>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerNav.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Learn. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
