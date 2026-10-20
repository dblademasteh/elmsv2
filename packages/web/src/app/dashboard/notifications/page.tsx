'use client'

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import {
  announcementApi,
  courseApi,
  notificationApi,
  type Announcement,
  type AppNotification,
} from "@/lib/api"
import {
  Bell,
  CheckCheck,
  Loader2,
  Megaphone,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { confirmAction } from "@/store/confirm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Tab = "notifications" | "announcements"

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("notifications")
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTitle, setComposeTitle] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [composeCourse, setComposeCourse] = useState("")
  const [myCourses, setMyCourses] = useState<Array<{ id: string; title: string }>>([])
  const [saving, setSaving] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)

  const canPost = user?.role === "admin" || user?.role === "instructor"

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [notifResponse, annResponse] = await Promise.all([
        notificationApi.list(),
        announcementApi.list(),
      ])
      if (notifResponse.data) {
        setNotifications(notifResponse.data.notifications)
        setUnreadCount(notifResponse.data.unread_count)
      } else {
        setLoadError(true)
      }
      if (annResponse.data) setAnnouncements(annResponse.data)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  useEffect(() => {
    if (!canPost) return
    courseApi
      .list(user?.role === "instructor" ? { mine: true, limit: 50 } : { limit: 50 })
      .then((response) => {
        if (response.data) setMyCourses(response.data.map((c) => ({ id: c.id, title: c.title })))
      })
      .catch(() => {})
  }, [canPost, user?.role])

  async function markRead(notification: AppNotification) {
    if (notification.read_at) return
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id
          ? { ...n, read_at: new Date().toISOString() }
          : n
      )
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    await notificationApi.markRead(notification.id).catch(() => {})
  }

  /**
   * Mark the notification read and take the user to whatever it points at.
   *
   * The API returns a `link_url` for every notification and the app bar
   * already navigates to it; the list did not, so the target of a
   * notification had to be found by hand.
   */
  async function openNotification(notification: AppNotification) {
    await markRead(notification)
    router.push(notification.link_url || "/dashboard/notifications")
  }

  async function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    )
    setUnreadCount(0)
    await notificationApi.markAllRead().catch(() => {})
  }

  function openCompose() {
    setComposeTitle("")
    setComposeBody("")
    setComposeCourse(user?.role === "instructor" && myCourses[0] ? myCourses[0].id : "")
    setComposeError(null)
    setComposeOpen(true)
  }

  async function handlePost() {
    if (composeTitle.trim().length < 3 || composeBody.trim().length < 3) {
      setComposeError("Title and body must be at least 3 characters.")
      return
    }
    if (user?.role === "instructor" && !composeCourse) {
      setComposeError("Choose one of your courses for the announcement.")
      return
    }
    setSaving(true)
    setComposeError(null)
    const response = await announcementApi.create({
      title: composeTitle.trim(),
      body: composeBody.trim(),
      ...(composeCourse ? { course_id: composeCourse } : {}),
    })
    setSaving(false)
    if (response.error) {
      setComposeError(response.error)
      return
    }
    setComposeOpen(false)
    load()
  }

  async function handleDelete(announcement: Announcement) {
    const confirmed = await confirmAction({
      title: "Delete this announcement?",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!confirmed) return
    const resp = await announcementApi.remove(announcement.id)
    if (resp.error) {
      toast({ title: "Could not delete announcement", description: resp.error })
      return
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id))
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tab === "notifications" && unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllRead}>
                <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Mark all read
              </Button>
            )}
            {tab === "announcements" && canPost && (
              <Button size="sm" onClick={openCompose}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New announcement
              </Button>
            )}
          </div>
        </div>

        <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/40 p-1" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "notifications"}
            onClick={() => setTab("notifications")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "notifications" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Notifications
          </button>
          <button
            role="tab"
            aria-selected={tab === "announcements"}
            onClick={() => setTab("announcements")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "announcements" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Announcements
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-medium">Not available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
          </div>
        ) : tab === "notifications" ? (
          notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Bell className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              <p className="mt-4 font-medium">No notifications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You'll be notified when assignments are graded or courses change.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openNotification(n)}
                    className={`w-full rounded-xl border px-5 py-4 text-left transition-colors ${
                      n.read_at
                        ? "border-border bg-card"
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm ${n.read_at ? "text-foreground" : "font-semibold text-foreground"}`}>
                          {n.title}
                        </p>
                        {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        {!n.read_at && (
                          <span className="mb-1 inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                        )}
                        <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-4 font-medium">No announcements</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canPost ? "Post one to keep learners informed." : "Announcements will appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Megaphone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <p className="font-semibold text-foreground">{a.title}</p>
                      {a.course_title ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {a.course_title}
                        </span>
                      ) : (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Platform-wide
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {a.author_name} · {timeAgo(a.created_at)}
                    </p>
                  </div>
                  {(user?.role === "admin" || a.author_name === user?.full_name) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(a)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete announcement: ${a.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New announcement</DialogTitle>
              <DialogDescription>
                {user?.role === "admin"
                  ? "Post platform-wide or target a specific course."
                  : "Post an announcement to one of your courses."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  placeholder="e.g. Live Q&A this Friday"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-body">Message</Label>
                <textarea
                  id="ann-body"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="What should learners know?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-course">Audience</Label>
                <select
                  id="ann-course"
                  value={composeCourse}
                  onChange={(e) => setComposeCourse(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {user?.role === "admin" && <option value="">Platform-wide (all users)</option>}
                  {myCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Course: {c.title}
                    </option>
                  ))}
                </select>
              </div>
              {composeError && (
                <p className="text-sm text-destructive" role="alert">
                  {composeError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handlePost} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Post announcement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
