'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  FileText,
  FileCheck,
  HelpCircle,
  LogOut,
  GraduationCap,
  User,
  ClipboardList,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  roles?: string[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "instructor", "student"] },
    ],
  },
  {
    label: "Learning",
    items: [
      { name: "Courses", href: "/dashboard/courses", icon: BookOpen, roles: ["admin", "instructor", "student"] },
      { name: "My Learning", href: "/dashboard/learning", icon: GraduationCap, roles: ["student"] },
      { name: "My Assignments", href: "/dashboard/assignments", icon: FileText, roles: ["student"] },
      { name: "Exams", href: "/dashboard/exams", icon: FileCheck, roles: ["student"] },
      { name: "Gradebook", href: "/dashboard/gradebook", icon: ClipboardList, roles: ["admin", "instructor", "student"] },
      { name: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["admin", "instructor", "student"] },
    ],
  },
  {
    label: "Management",
    items: [
      { name: "Users", href: "/dashboard/users", icon: Users, roles: ["admin"] },
      { name: "Students", href: "/dashboard/students", icon: Users, roles: ["admin", "instructor"] },
      { name: "Exams", href: "/dashboard/exams", icon: FileCheck, roles: ["admin", "instructor"] },
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, roles: ["admin", "instructor"] },
      { name: "Content", href: "/dashboard/content", icon: FileText, roles: ["admin", "instructor"] },
      { name: "Enrollments", href: "/dashboard/enrollments", icon: Users, roles: ["admin", "instructor"] },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Profile", href: "/profile", icon: User, roles: ["admin", "instructor", "student"] },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["admin", "instructor", "student"] },
      { name: "Help Center", href: "/dashboard/help", icon: HelpCircle, roles: ["admin", "instructor", "student"] },
    ],
  },
]

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        isActive
          ? "bg-primary/10 text-primary shadow-inner shadow-primary/5"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-label={item.name}
      aria-current={isActive ? "page" : undefined}
    >
      <item.icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors duration-200",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
        aria-hidden="true"
      />
      <span className="truncate">{item.name}</span>

      {isActive && (
        <span
          className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-primary transition-all"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}

function NavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <div className="mb-6 last:mb-0">
      <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 mb-2">
        {group.label}
      </p>
      <div className="space-y-1">
        {group.items.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return <NavLink key={item.name} item={item} isActive={isActive} />
        })}
      </div>
    </div>
  )
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button
      onClick={onSignOut}
      className="group relative flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      aria-label="Sign out"
    >
      <LogOut
        className="h-5 w-5 shrink-0 transition-colors group-hover:text-destructive"
        aria-hidden="true"
      />
      <span>Sign Out</span>
    </button>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
      case "instructor":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
      default:
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
    }
  }

  // Filter and group navigation items by user role
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || !user?.role || item.roles.includes(user.role)
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside
      className="flex h-screen w-64 flex-col overflow-y-auto overflow-x-hidden bg-card border-r border-border scrollbar-thin"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-6 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <span className="text-xl font-bold tracking-tight text-foreground">
          Learn<span className="text-primary">.</span>
        </span>
      </div>

      {/* User Info */}
      {user && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20">
            {user.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() ?? "U"}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
                user.role === "admin"
                  ? "bg-amber-400"
                  : user.role === "instructor"
                  ? "bg-emerald-400"
                  : "bg-sky-400"
              )}
              aria-label={`Status: ${user.role}`}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {user.full_name}
            </span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
              getRoleColor(user.role)
            )}
          >
            {user.role}
          </span>
        </div>
      )}

      {/* Main Navigation - Grouped */}
      <nav className="flex-1 space-y-1 px-3 py-6" aria-label="Main navigation">
        {visibleGroups.map((group) => (
          <NavGroup key={group.label} group={group} pathname={pathname} />
        ))}
      </nav>

      {/* Bottom: Sign Out */}
      <div className="shrink-0 border-t border-border px-3 py-4">
        <SignOutButton onSignOut={logout} />
      </div>
    </aside>
  )
}
