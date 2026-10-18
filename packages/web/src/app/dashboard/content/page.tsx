'use client'

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FileText, Loader2 } from "lucide-react"
import { courseApi, lessonApi } from "@/lib/api"

type ContentRow = {
  lesson_id: string
  course_title: string
  title: string
  content_type: string
  is_published: boolean
  position: number
  estimated_minutes: number
  section_title: string | null
}

const TYPE_LABELS: Record<string, string> = {
  video: "Video",
  text: "Text",
  quiz: "Quiz",
  assignment: "Assignment",
  download: "Download",
}

export default function DashboardContentPage() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.role !== "admin" && user.role !== "instructor") return
    let active = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const coursesResponse = await courseApi.list(
          user?.role === "instructor" ? { mine: true, limit: 50 } : { limit: 50 }
        )
        const courses = coursesResponse.data ?? []
        const lessonLists = await Promise.all(
          courses.map((c) => lessonApi.listByCourse(c.id))
        )
        if (!active) return
        const content: ContentRow[] = []
        courses.forEach((course, index) => {
          for (const lesson of lessonLists[index].data ?? []) {
            content.push({
              lesson_id: lesson.id,
              course_title: course.title,
              title: lesson.title,
              content_type: lesson.content_type,
              is_published: lesson.is_published,
              position: lesson.position,
              estimated_minutes: lesson.estimated_minutes,
              section_title: lesson.section_title ?? null,
            })
          }
        })
        content.sort(
          (a, b) => a.course_title.localeCompare(b.course_title) || a.position - b.position
        )
        setRows(content)
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user])

  if (user?.role !== "admin" && user?.role !== "instructor") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold">Content</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">You do not have access to content management.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Content</h1>
          </div>
          {!loading && !loadError && (
            <p className="text-sm text-muted-foreground">
              {rows.length} lesson{rows.length === 1 ? "" : "s"} across{" "}
              {new Set(rows.map((r) => r.course_title)).size} course
              {new Set(rows.map((r) => r.course_title)).size === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-medium">Content isn't available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-4 font-medium">No lessons yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lessons you create will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Lesson</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Length</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.lesson_id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{r.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.course_title}</td>
                    <td className="px-4 py-3">
                      <input
                        defaultValue={r.section_title ?? ""}
                        placeholder="—"
                        aria-label={`Section for ${r.title}`}
                        onBlur={async (e) => {
                          const value = e.target.value.trim()
                          if (value === (r.section_title ?? "")) return
                          const response = await lessonApi.update(r.lesson_id, {
                            section_title: value || null,
                          })
                          if (!response.error) {
                            setRows((prev) =>
                              prev.map((row) =>
                                row.lesson_id === r.lesson_id
                                  ? { ...row, section_title: value || null }
                                  : row
                              )
                            )
                          }
                        }}
                        className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-3">{TYPE_LABELS[r.content_type] ?? r.content_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.estimated_minutes > 0 ? `${r.estimated_minutes} min` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          r.is_published
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {r.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
