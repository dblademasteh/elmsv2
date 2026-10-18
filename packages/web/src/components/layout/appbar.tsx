'use client'

import { useState, useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Menu, Bell, Search, User, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { authApi, notificationApi, type AppNotification } from "@/lib/api"

interface AppBarProps {
  onMenuClick?: () => void
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/courses": "Courses",
  "/dashboard/learning": "My Learning",
  "/dashboard/users": "Users",
  "/dashboard/analytics": "Analytics",
  "/dashboard/content": "Content",
  "/dashboard/enrollments": "Enrollment Requests",
  "/dashboard/notifications": "Notifications",
  "/dashboard/assignments": "Assignments",
  "/dashboard/gradebook": "Gradebook",
  "/dashboard/students": "Students",
  "/dashboard/settings": "Settings",
  "/dashboard/help": "Help Center",
  "/profile": "Profile",
}

function getPageTitle(path: string): string {
  const match = Object.entries(pageTitles)
    .sort(([left], [right]) => right.length - left.length)
    .find(([key]) => path === key || path.startsWith(`${key}/`))

  if (match) return match[1]
  return "Dashboard"
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function SearchBar() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce the search — only trigger on user stop typing
  useEffect(() => {
    if (query.length < 2) return

    const timer = setTimeout(() => {
      if (query.length >= 2) {
        router.push(`/courses?q=${encodeURIComponent(query)}`)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, router])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim().length >= 2) {
      router.push(`/courses?q=${encodeURIComponent(query.trim())}`)
    } else if (e.key === "Escape") {
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative hidden md:block">
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <label htmlFor="appbar-search" className="sr-only">
        Search courses, users, content
      </label>
      <input
        id="appbar-search"
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="h-9 w-64 rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
        aria-label="Search"
        autoComplete="off"
      />
    </div>
  )
}

function NotificationButton() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    notificationApi.list().then((response) => {
      if (response.data) {
        setNotifications(response.data.notifications.slice(0, 5))
        setUnreadCount(response.data.unread_count)
      }
    })
  }, [])

  // Close dropdown on Escape or click outside
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      window.addEventListener("keydown", handleKeydown)
      window.addEventListener("mousedown", handleClick)
      return () => {
        window.removeEventListener("keydown", handleKeydown)
        window.removeEventListener("mousedown", handleClick)
      }
    }
  }, [open])

  const markAllRead = async () => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? new Date().toISOString(),
      }))
    )
    setUnreadCount(0)
    await notificationApi.markAllRead()
  }

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read_at) {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      )
      setUnreadCount((count) => Math.max(0, count - 1))
      await notificationApi.markRead(notification.id)
    }
    setOpen(false)
    router.push(notification.link_url || "/dashboard/notifications")
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label={unreadCount > 0 ? `You have ${unreadCount} unread notifications` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-border"
          role="menu"
          aria-orientation="vertical"
          aria-label="Notifications"
          tabIndex={-1}
        >
          <div className="p-3 pb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-medium hover:text-foreground"
                  onClick={markAllRead}
                  aria-label="Mark all as read"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={cn(
                    "flex w-full items-start gap-3 p-3 text-left text-sm transition-colors hover:bg-accent",
                    !notification.read_at && "bg-accent/30"
                  )}
                  role="menuitem"
                  onClick={() => openNotification(notification)}
                >
                  <Bell className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{notification.title}</p>
                    {notification.body && (
                      <p className="text-xs text-muted-foreground">{notification.body}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false)
                router.push("/dashboard/notifications")
              }}
            >
              View all notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      window.addEventListener("keydown", handleKeydown)
      window.addEventListener("mousedown", handleClick)
      return () => {
        window.removeEventListener("keydown", handleKeydown)
        window.removeEventListener("mousedown", handleClick)
      }
    }
  }, [open])

  const handleLogout = async () => {
    await authApi.logout()
    logout()
    setOpen(false)
    router.replace("/login")
    router.refresh()
  }

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

  if (!user) return null

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
        onClick={() => setOpen(!open)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
          {user.full_name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() ?? "U"}
        </div>
        <span className="hidden text-sm font-medium sm:inline-block">
          {user.full_name}
        </span>
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-border"
            role="menu"
            aria-orientation="vertical"
            tabIndex={-1}
          >
            <div className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {user.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() ?? "U"}
                </div>
                <div className="flex-1 truncate">
                  <p className="font-medium text-foreground">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span
                  className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getRoleColor(user.role))}
                >
                  {user.role}
                </span>
              </div>
            </div>

            <div className="border-t border-border py-1.5">
              <button
                onClick={() => {
                  setOpen(false)
                  router.push("/profile")
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                role="menuitem"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                Profile
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  router.push("/dashboard/settings")
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
                role="menuitem"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Settings
              </button>
            </div>

            <div className="border-t border-border py-1.5">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 focus-visible:outline-none"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function AppBar({ onMenuClick }: AppBarProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-8"
      role="banner"
    >
      {/* Left: Menu toggle + Breadcrumb */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>

        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      {/* Right: Search + Notifications + User Menu */}
      <div className="flex items-center gap-3">
        <SearchBar />
        <NotificationButton />
        <UserMenu />
      </div>
    </header>
  )
}
