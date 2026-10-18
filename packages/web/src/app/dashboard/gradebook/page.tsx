'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { gradebookApi, type GradebookRow } from "@/lib/api"
import { ClipboardList, Download, Loader2 } from "lucide-react"

function GradeCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const tone =
    value >= 85
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : value >= 70
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {value.toFixed(1)}%
    </span>
  )
}

export default function GradebookPage() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<GradebookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [courseFilter, setCourseFilter] = useState<string>("")

  const isStudent = user?.role === "student"

  const load = useCallback(async (courseId: string) => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await gradebookApi.list(courseId || undefined)
      if (response.data) {
        setRows(response.data)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    load("")
  }, [user, load])

  const courses = useMemo(() => {
    const seen = new Map<string, string>()
    rows.forEach((r) => seen.set(r.course_id, r.course_title))
    return Array.from(seen, ([id, title]) => ({ id, title }))
  }, [rows])

  const filteredRows = useMemo(
    () => (courseFilter ? rows.filter((r) => r.course_id === courseFilter) : rows),
    [rows, courseFilter]
  )

  async function handleExport() {
    setExporting(true)
    try {
      await gradebookApi.exportCsv(courseFilter || undefined)
    } finally {
      setExporting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Gradebook</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {!isStudent && (
              <Button onClick={handleExport} disabled={exporting || rows.length === 0}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-medium">Gradebook isn't available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-4 font-medium">No grades yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isStudent
                ? "Grades appear here once you complete quizzes or have assignments graded."
                : "Grades appear here once students complete quizzes or submit assignments."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-muted-foreground">
                  <th className="px-4 py-3 font-medium">{isStudent ? "Course" : "Student"}</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Quizzes</th>
                  <th className="px-4 py-3 font-medium">Assignments</th>
                  <th className="px-4 py-3 font-medium">Overall</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.enrollment_id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {isStudent ? r.course_title : r.student_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isStudent ? r.status : r.course_title}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, r.progress_percent)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(r.progress_percent)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <GradeCell value={r.quiz_avg_grade} />
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.graded_quiz_count} graded
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <GradeCell value={r.assignment_avg_percent} />
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.graded_assignment_count} graded
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <GradeCell value={r.overall_grade} />
                    </td>
                    <td className="px-4 py-3 capitalize text-xs text-muted-foreground">
                      {r.status}
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
