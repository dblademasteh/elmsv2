'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { enrollmentApi } from "@/lib/api"
import { BookOpen, Loader2 } from "lucide-react"

type MyEnrollment = {
  id: string
  course_id: string
  course_title: string
  course_level: string
  course_cover_image_url: string | null
  enrolled_at: string
  progress_percent: number
  status: string
  completed_at: string | null
  total_minutes: number
  last_accessed_at: string | null
}

export default function DashboardLearningPage() {
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    enrollmentApi.getMyEnrollments().then((response) => {
      if (response.data) {
        setEnrollments(response.data)
      } else {
        setError(response.error || "Failed to load your courses")
      }
      setLoading(false)
    }).catch(() => {
      setError("Failed to load your courses")
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">My Learning</h1>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-6">My Learning</h1>
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <p>{error}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (enrollments.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-6">My Learning</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No courses yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't enrolled in any courses. Browse the catalog to get started.
            </p>
            <Link href="/courses">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline cursor-pointer">
                Browse courses
              </span>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Learning</h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const progress = Math.round(enrollment.progress_percent || 0)
            const isCompleted = enrollment.status === "completed"

            return (
              <Link
                key={enrollment.id}
                href={`/courses/${enrollment.course_id}/learn`}
                className="group block"
              >
                <div className="rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-medium text-primary">
                      {progress}%
                    </span>
                  </div>

                  <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                    {enrollment.course_title}
                  </h3>

                  <p className="text-sm text-muted-foreground mb-3">
                    {enrollment.course_level}
                  </p>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      {isCompleted ? (
                        <span className="text-green-500 font-medium">Completed</span>
                      ) : (
                        <span>{progress}% complete</span>
                      )}
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  {enrollment.last_accessed_at && (
                    <p className="text-xs text-muted-foreground">
                      Last accessed: {new Date(enrollment.last_accessed_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
