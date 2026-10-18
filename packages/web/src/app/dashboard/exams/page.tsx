'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuthStore } from "@/store/auth"
import { courseApi, lessonApi, quizApi, enrollmentApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertCircle,
  ClipboardList,
  ExternalLink,
  Loader2,
  Plus,
  Search,
} from "lucide-react"
import { formatDateTime, formatDuration } from "@/lib/format"

type CourseRow = {
  id: string
  title: string
}

type QuizRow = {
  id: string
  lesson_id: string
  title: string
  description: string | null
  question_count: number
  time_limit_seconds: number | null
  max_attempts: number
  passing_grade: number
  created_at: string
  course_id: string
  course_title: string
  lesson_title: string
}

type LessonRow = {
  id: string
  title: string
}

export default function ExamsPage() {
  const { user } = useAuthStore()
  const role = user?.role
  const isManager = role === "admin" || role === "instructor"

  const [exams, setExams] = useState<QuizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [courseId, setCourseId] = useState("")
  const [lessonId, setLessonId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("60")
  const [maxAttempts, setMaxAttempts] = useState("3")
  const [passingGrade, setPassingGrade] = useState("70")

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      if (isManager) {
        const coursesResp = await courseApi.list({ mine: true, limit: 50 })
        if (!coursesResp.data) {
          setError(coursesResp.error || "Failed to load courses")
          setLoading(false)
          return
        }
        const courseList = coursesResp.data as CourseRow[]
        setCourses(courseList)

        const rows: QuizRow[] = []
        const results = await Promise.allSettled(
          courseList.map(async (course) => {
            const [quizzesResp, lessonsResp] = await Promise.all([
              quizApi.getByCourse(course.id),
              lessonApi.listByCourse(course.id),
            ])
            const lessonTitles = new Map<string, string>(
              (lessonsResp.data || []).map((l) => [l.id, l.title])
            )
            return (quizzesResp.data || []).map((q) => ({
              id: q.id,
              lesson_id: q.lesson_id,
              title: q.title,
              description: q.description,
              question_count: (q.questions || []).length,
              time_limit_seconds: q.time_limit_seconds,
              max_attempts: q.max_attempts,
              passing_grade: q.passing_grade,
              created_at: q.created_at,
              course_id: course.id,
              course_title: course.title,
              lesson_title: lessonTitles.get(q.lesson_id) || "—",
            }))
          })
        )
        for (const r of results) {
          if (r.status === "fulfilled") rows.push(...r.value)
        }
        setExams(rows)
      } else {
        const enrollmentsResp = await enrollmentApi.list({ limit: 100 })
        if (!enrollmentsResp.data) {
          setError(enrollmentsResp.error || "Failed to load enrollments")
          setLoading(false)
          return
        }
        const enrolled = enrollmentsResp.data as Array<{ course_id: string; course_title: string }>
        const seen = new Set<string>()
        const courseList = enrolled.filter((e) => {
          if (seen.has(e.course_id)) return false
          seen.add(e.course_id)
          return true
        })

        const rows: QuizRow[] = []
        const results = await Promise.allSettled(
          courseList.map(async (course) => {
            const [quizzesResp, lessonsResp] = await Promise.all([
              quizApi.getByCourse(course.course_id),
              lessonApi.listByCourse(course.course_id),
            ])
            const lessonTitles = new Map<string, string>(
              (lessonsResp.data || []).map((l) => [l.id, l.title])
            )
            return (quizzesResp.data || []).map((q) => ({
              id: q.id,
              lesson_id: q.lesson_id,
              title: q.title,
              description: q.description,
              question_count: (q.questions || []).length,
              time_limit_seconds: q.time_limit_seconds,
              max_attempts: q.max_attempts,
              passing_grade: q.passing_grade,
              created_at: q.created_at,
              course_id: course.course_id,
              course_title: course.course_title,
              lesson_title: lessonTitles.get(q.lesson_id) || "—",
            }))
          })
        )
        for (const r of results) {
          if (r.status === "fulfilled") rows.push(...r.value)
        }
        setExams(rows)
      }
    } catch {
      setError("Failed to load exams")
    }
    setLoading(false)
  }, [user, isManager])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () =>
      exams.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.course_title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [exams, searchQuery]
  )

  function openCreate() {
    setCourseId(courses[0]?.id || "")
    setLessonId("")
    setLessons([])
    setTitle("")
    setDescription("")
    setTimeLimitMinutes("60")
    setMaxAttempts("3")
    setPassingGrade("70")
    setFormError(null)
    setDialogOpen(true)
  }

  useEffect(() => {
    if (!dialogOpen || !courseId) return
    let cancelled = false
    setLoadingLessons(true)
    lessonApi.listByCourse(courseId).then((resp) => {
      if (!cancelled) {
        setLessons(resp.data || [])
        setLessonId(resp.data?.[0]?.id || "")
        setLoadingLessons(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [dialogOpen, courseId])

  async function handleCreate() {
    if (!courseId) {
      setFormError("Select a course.")
      return
    }
    if (!lessonId) {
      setFormError("Select a lesson for this exam.")
      return
    }
    if (title.trim().length < 3) {
      setFormError("Exam title must be at least 3 characters.")
      return
    }
    const minutes = Number.parseInt(timeLimitMinutes, 10)
    const attempts = Number.parseInt(maxAttempts, 10)
    const grade = Number.parseInt(passingGrade, 10)
    if (Number.isNaN(attempts) || attempts < 1) {
      setFormError("Max attempts must be at least 1.")
      return
    }
    if (Number.isNaN(grade) || grade < 0 || grade > 100) {
      setFormError("Passing grade must be between 0 and 100.")
      return
    }

    setSaving(true)
    setFormError(null)
    const response = await quizApi.create({
      lesson_id: lessonId,
      title: title.trim(),
      questions: [],
      time_limit_seconds: !Number.isNaN(minutes) && minutes > 0 ? minutes * 60 : undefined,
      max_attempts: attempts,
      passing_grade: grade,
      description: description.trim() || undefined,
    } as Parameters<typeof quizApi.create>[0])
    setSaving(false)
    if (response.error) {
      setFormError(response.error)
      return
    }
    setDialogOpen(false)
    load()
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">Exams</h1>
            <span className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "exam" : "exams"}
            </span>
          </div>
          {isManager && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Exam
            </Button>
          )}
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

        {/* Search */}
        <Card className="mb-4 border-border">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search exams or courses…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                aria-label="Search exams"
              />
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="h-4 flex-1 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? null : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-4 font-medium">
              {isManager ? "No exams yet" : "No exams available"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManager
                ? "Create your first exam and attach it to a lesson."
                : "Exams will appear here once your courses include them."}
            </p>
            {isManager && (
              <Button className="mt-6" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New Exam
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="w-72 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam</th>
                  <th className="w-20 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</th>
                  <th className="w-24 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  <th className="w-24 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passing</th>
                  <th className="w-28 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="w-28 truncate px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((exam) => (
                  <tr key={exam.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <p className="truncate font-medium text-foreground">{exam.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {exam.course_title} · {exam.lesson_title}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">{exam.question_count}</td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      {formatDuration(exam.time_limit_seconds)}
                    </td>
                    <td className="px-6 py-4 text-center">{exam.passing_grade}%</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDateTime(exam.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      {isManager ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/dashboard/courses/${exam.course_id}/quizzes`}>
                            Manage
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" asChild disabled={exam.question_count === 0}>
                          <Link href={`/dashboard/quizzes/${exam.id}/take`}>Take</Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* New Exam Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New exam</DialogTitle>
              <DialogDescription>
                Attach the exam to a course lesson, then add questions via Manage.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="exam-course">Course</Label>
                <select
                  id="exam-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Select a course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-lesson">Lesson</Label>
                <select
                  id="exam-lesson"
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  disabled={loadingLessons || !courseId}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                >
                  {loadingLessons ? (
                    <option value="">Loading lessons…</option>
                  ) : lessons.length === 0 ? (
                    <option value="">No lessons in this course</option>
                  ) : (
                    <>
                      <option value="">Select a lesson…</option>
                      {lessons.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-title">Exam title</Label>
                <Input
                  id="exam-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midterm Examination"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-description">Description (optional)</Label>
                <textarea
                  id="exam-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="What does this exam cover?"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-time">Time (min)</Label>
                  <Input
                    id="exam-time"
                    type="number"
                    min="1"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exam-attempts">Max attempts</Label>
                  <Input
                    id="exam-attempts"
                    type="number"
                    min="1"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exam-grade">Passing %</Label>
                  <Input
                    id="exam-grade"
                    type="number"
                    min="0"
                    max="100"
                    value={passingGrade}
                    onChange={(e) => setPassingGrade(e.target.value)}
                  />
                </div>
              </div>
              {formError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {formError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving || loadingLessons}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Create exam
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
