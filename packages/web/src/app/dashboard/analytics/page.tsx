'use client'

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { BarChart3, Loader2 } from "lucide-react"
import { dashboardApi, courseApi } from "@/lib/api"

type Stats = {
  role: string
  total_users?: number
  active_users?: number
  total_courses?: number
  published_courses?: number
  total_enrollments?: number
  completed_enrollments?: number
  avg_progress?: number
  revenue_cents?: number
  students_taught?: number
  avg_rating?: number
  pending_submissions?: number
}

type CourseRow = {
  id: string
  title: string
  enrollment_count: number
  rating_average: number
  price_cents: number
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

export default function DashboardAnalyticsPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.role === "student") return
    let active = true

    Promise.all([
      dashboardApi.getStats(),
      courseApi.list(user.role === "instructor" ? { mine: true, limit: 50 } : { limit: 50 }),
    ])
      .then(([statsResponse, coursesResponse]) => {
        if (!active) return
        if (statsResponse.data) setStats(statsResponse.data)
        if (coursesResponse.data) setCourses(coursesResponse.data)
        if (!statsResponse.data) setLoadError(true)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoadError(true)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  if (user?.role !== "admin" && user?.role !== "instructor") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">You do not have access to analytics.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const maxEnrollments = Math.max(1, ...courses.map((c) => c.enrollment_count))
  const cards: Array<{ label: string; value: string | number }> = []
  if (stats) {
    if (stats.role === "admin") {
      cards.push(
        { label: "Total users", value: stats.total_users ?? 0 },
        { label: "Active users", value: stats.active_users ?? 0 },
        { label: "Published courses", value: stats.published_courses ?? 0 },
        { label: "Enrollments", value: stats.total_enrollments ?? 0 },
        { label: "Completed", value: stats.completed_enrollments ?? 0 },
        { label: "Avg progress", value: `${stats.avg_progress ?? 0}%` },
        {
          label: "Enrollment value",
          value: new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: "PHP",
          }).format((stats.revenue_cents ?? 0) / 100),
        },
      )
    } else {
      cards.push(
        { label: "Students taught", value: stats.students_taught ?? 0 },
        { label: "Published courses", value: stats.published_courses ?? 0 },
        { label: "Enrollments", value: stats.total_enrollments ?? 0 },
        { label: "Completed", value: stats.completed_enrollments ?? 0 },
        { label: "Avg progress", value: `${stats.avg_progress ?? 0}%` },
        {
          label: "Avg rating",
          value: stats.avg_rating && stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "—",
        },
        { label: "Pending submissions", value: stats.pending_submissions ?? 0 },
      )
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Analytics</h1>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : loadError || !stats ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-medium">Analytics aren't available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <StatCard key={c.label} label={c.label} value={c.value} />
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">
                Enrollments by course {user.role === "instructor" ? "(your courses)" : ""}
              </h3>
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {user.role === "instructor"
                    ? "You haven't created any courses yet."
                    : "No courses yet."}
                </p>
              ) : (
                <div className="space-y-3">
                  {courses
                    .slice()
                    .sort((a, b) => b.enrollment_count - a.enrollment_count)
                    .map((c) => (
                      <div key={c.id} className="flex items-center gap-4">
                        <span className="w-48 shrink-0 truncate text-sm text-foreground" title={c.title}>
                          {c.title}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.round((c.enrollment_count / maxEnrollments) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                          {c.enrollment_count}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
