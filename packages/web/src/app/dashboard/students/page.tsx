'use client'

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { enrollmentApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Users, Search, Filter, Clock, CheckCircle, XCircle, PauseCircle, AlertCircle, Loader2 } from "lucide-react"

type Enrollment = {
  id: string
  user_id: string
  user_full_name: string
  user_email: string
  user_avatar_url: string | null
  course_id: string
  course_title: string
  course_level: string
  enrolled_at: string
  progress_percent: number
  status: string
  completed_at: string | null
  total_minutes: number
  last_accessed_at: string | null
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  active: { label: "Active", icon: CheckCircle, color: "text-green-500" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-blue-500" },
  dropped: { label: "Dropped", icon: XCircle, color: "text-red-500" },
  paused: { label: "Paused", icon: PauseCircle, color: "text-amber-500" },
}

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  })
}

function formatMinutes(minutes: number) {
  if (!minutes || minutes === 0) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function StudentAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-9 w-9 rounded-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none"
          ;(e.target as HTMLImageElement).parentElement!.classList.add("bg-muted")
        }}
      />
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
      {name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() ?? "U"}
    </div>
  )
}

export default function DashboardStudentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [courseFilter, setCourseFilter] = useState<string>("all")

  useEffect(() => {
    setLoading(true)
    enrollmentApi
      .list({ limit: 100 })
      .then((response) => {
        if (response.data) {
          setEnrollments(response.data)
        } else {
          setError(response.error || "Failed to load enrollments")
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load enrollments")
        setLoading(false)
      })
  }, [])

  // Get unique courses for filter
  const uniqueCourses = Array.from(
    new Set(enrollments.map((e) => e.course_title))
  )

  // Apply filters
  const filtered = enrollments.filter((e) => {
    const matchesSearch =
      e.user_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.course_title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || e.status === statusFilter
    const matchesCourse =
      courseFilter === "all" || e.course_title === courseFilter
    return matchesSearch && matchesStatus && matchesCourse
  })

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Students</h1>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-6 py-4 animate-pulse"
                >
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="h-4 flex-1 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Students</h1>
            <span className="text-sm text-muted-foreground">
              {filtered.length} enrolled {filtered.length === 1 ? "student" : "students"}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Filters */}
        <Card className="mb-4 border-border">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search student name, email, or course…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                aria-label="Search students"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>

            {/* Course filter */}
            {uniqueCourses.length > 1 && (
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                aria-label="Filter by course"
              >
                <option value="all">All courses</option>
                {uniqueCourses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Card>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="w-48 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Student
                </th>
                <th className="w-56 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </th>
                <th className="w-48 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Course
                </th>
                <th className="w-24 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Level
                </th>
                <th className="w-24 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Progress
                </th>
                <th className="w-24 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="w-32 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Enrolled
                </th>
                <th className="w-28 truncate px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Last access
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                      <p>No students found.</p>
                      {searchQuery || statusFilter !== "all" || courseFilter !== "all" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("")
                            setStatusFilter("all")
                            setCourseFilter("all")
                          }}
                        >
                          Clear filters
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((enrollment) => {
                  const statusInfo =
                    statusConfig[enrollment.status] || statusConfig.active
                  const StatusIcon = statusInfo.icon
                  return (
                    <tr
                      key={enrollment.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* Student */}
                      <td className="w-48 truncate px-6 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            name={enrollment.user_full_name}
                            avatarUrl={enrollment.user_avatar_url}
                          />
                          <span className="font-medium text-foreground">
                            {enrollment.user_full_name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="w-56 truncate px-6 py-4 align-top text-muted-foreground">
                        {enrollment.user_email}
                      </td>

                      {/* Course */}
                      <td className="w-48 truncate px-6 py-4 align-top">
                        <span className="font-medium text-foreground">
                          {enrollment.course_title}
                        </span>
                      </td>

                      {/* Level */}
                      <td className="w-24 truncate px-6 py-4 align-top">
                        <span
                          className={
                            enrollment.course_level === "beginner"
                              ? "rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/20 dark:text-green-400"
                              : enrollment.course_level === "intermediate"
                                ? "rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                                : "rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
                          }
                        >
                          {levelLabels[enrollment.course_level] || enrollment.course_level}
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="w-24 truncate px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="w-full">
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className="h-1.5 rounded-full bg-primary"
                                style={{
                                  width: `${Math.min(enrollment.progress_percent, 100)}%`,
                                }}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                          <span className="w-8 text-right text-xs font-medium text-muted-foreground">
                            {enrollment.progress_percent}%
                          </span>
                        </div>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatMinutes(enrollment.total_minutes)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="w-24 truncate px-6 py-4 align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <StatusIcon
                            className={`h-4 w-4 ${statusInfo.color}`}
                            aria-hidden="true"
                          />
                          <span className="font-medium">{statusInfo.label}</span>
                        </div>
                      </td>

                      {/* Enrolled */}
                      <td className="w-32 truncate px-6 py-4 align-top text-muted-foreground">
                        {formatDate(enrollment.enrolled_at)}
                      </td>

                      {/* Last access */}
                      <td className="w-28 truncate px-6 py-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="text-xs">
                            {formatDate(enrollment.last_accessed_at)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
