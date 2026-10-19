'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuthStore } from "@/store/auth"
import { courseApi, lessonApi, quizApi, enrollmentApi } from "@/lib/api"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ClipboardList, ExternalLink, FileCheck, Loader2, Plus, Search } from "lucide-react"
import { formatDateTime, formatDuration } from "@/lib/format"
import { useToast } from "@/components/ui/use-toast"

const createExamSchema = z.object({
  lesson_id: z.string().min(1, "Select a lesson"),
  title: z.string().min(3, "Exam title must be at least 3 characters"),
  description: z.string().optional(),
  exam_type: z.enum(["multiple_choice", "enumeration", "identification", "true_false", "essay"]).default("multiple_choice"),
  time_limit_minutes: z.coerce.number().min(1, "Time must be at least 1 minute"),
  max_attempts: z.coerce.number().min(1, "Max attempts must be at least 1"),
  passing_grade: z.coerce.number().min(0).max(100, "Passing grade must be between 0 and 100"),
})

type CreateExamData = z.infer<typeof createExamSchema>

type CourseRow = { id: string; title: string }
type LessonRow = { id: string; title: string }
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
  quiz_type: string
}

export default function ExamsPage() {
  const { user } = useAuthStore()
  const role = user?.role
  const isManager = role === "admin" || role === "instructor"
  const { toast } = useToast()

  const [exams, setExams] = useState<QuizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<CreateExamData>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      lesson_id: "",
      title: "",
      description: "",
      exam_type: "multiple_choice",
      time_limit_minutes: 60,
      max_attempts: 3,
      passing_grade: 70,
    },
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      if (isManager) {
        const coursesResp = await courseApi.list({ mine: true, limit: 50 })
        if (!coursesResp.data) {
          toast({ title: "Failed to load courses", description: coursesResp.error })
          setLoading(false)
          return
        }
        const courseList = coursesResp.data as CourseRow[]
        const rows: QuizRow[] = []
        await Promise.all(
          courseList.map(async (course) => {
            const [quizzesResp, lessonsResp] = await Promise.all([
              quizApi.getByCourse(course.id),
              lessonApi.listByCourse(course.id),
            ])
            const lessonTitles = new Map<string, string>(
              (lessonsResp.data || []).map((l) => [l.id, l.title]),
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
              quiz_type: q.quiz_type ?? "multiple_choice",
            }))
          }),
        ).then((groups) => {
          groups.forEach((group) => rows.push(...group))
          setExams(rows)
          setCourses(courseList)
        })
      } else {
        const enrollmentsResp = await enrollmentApi.list({ limit: 100 })
        if (!enrollmentsResp.data) {
          toast({ title: "Failed to load enrollments", description: enrollmentsResp.error, })
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
        await Promise.all(
          courseList.map(async (course) => {
            const [quizzesResp, lessonsResp] = await Promise.all([
              quizApi.getByCourse(course.course_id),
              lessonApi.listByCourse(course.course_id),
            ])
            const lessonTitles = new Map<string, string>(
              (lessonsResp.data || []).map((l) => [l.id, l.title]),
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
              quiz_type: q.quiz_type ?? "multiple_choice",
            }))
          }),
        ).then((groups) => {
          groups.forEach((group) => rows.push(...group))
          setExams(rows)
        })
      }
    } catch {
      toast({ title: "Failed to load exams", })
    } finally {
      setLoading(false)
    }
  }, [user, isManager, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleCourseChange = (value: string) => {
    form.setValue("lesson_id", "")
    setLessons([])
    if (!value) return
    const course = courses.find((c) => c.id === value)
    if (!course) return
    setLoadingLessons(true)
    lessonApi.listByCourse(course.id).then((resp) => {
      setLessons(resp.data || [])
      setLoadingLessons(false)
    })
  }

  const filtered = useMemo(
    () =>
      exams.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.course_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.lesson_title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [exams, searchQuery],
  )

  const onSubmit = async (data: CreateExamData) => {
    setSaving(true)
    try {
      const response = await quizApi.create({
        lesson_id: data.lesson_id,
        title: data.title.trim(),
        questions: [],
        time_limit_seconds: data.time_limit_minutes * 60,
        max_attempts: data.max_attempts,
        passing_grade: data.passing_grade,
        description: data.description?.trim() || undefined,
        quiz_type: data.exam_type,
      } as Parameters<typeof quizApi.create>[0])
      if (response.error) {
        toast({ title: "Failed to create exam", description: response.error, })
        return
      }
      setDialogOpen(false)
      form.reset({ lesson_id: "", title: "", description: "", exam_type: "multiple_choice", time_limit_minutes: 60, max_attempts: 3, passing_grade: 70 })
      setLessons([])
      load()
      toast({ title: "Exam created" })
    } catch {
      toast({ title: "Failed to create exam", })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-semibold">Exams</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "exam" : "exams"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search exams or courses…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-10 pr-4"
                aria-label="Search exams"
              />
            </div>
            {isManager && (
              <Button onClick={() => setDialogOpen(true)} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New Exam
              </Button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="h-4 flex-1 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-6 w-14 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <h2 className="mt-4 font-medium">{isManager ? "No exams yet" : "No exams available"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManager
                ? "Create your first exam and attach it to a lesson."
                : "Exams will appear here once your courses include them."}
            </p>
            {isManager && (
              <Button className="mt-6" onClick={() => setDialogOpen(true)} disabled={courses.length === 0}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New Exam
              </Button>
            )}
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="w-[220px] px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exam</th>
                  <th className="w-20 px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="w-24 px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Questions</th>
                  <th className="w-20 px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  <th className="w-20 px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passing</th>
                  <th className="w-28 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="w-24 px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((exam) => (
                  <tr key={exam.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{exam.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {exam.course_title} · {exam.lesson_title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="outline">{exam.quiz_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="secondary">{exam.question_count}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-muted-foreground">{formatDuration(exam.time_limit_seconds)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="outline">{exam.passing_grade}%</Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDateTime(exam.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      {isManager ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/dashboard/courses/${exam.course_id}/quizzes`}>
                            Manage
                            <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          asChild
                          disabled={exam.question_count === 0}
                        >
                          <Link href={`/dashboard/quizzes/${exam.id}/take`}>
                            Take
                            <FileCheck className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Exam Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New exam</DialogTitle>
            <DialogDescription>
              Attach the exam to a course lesson, then add questions via Manage.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exam-course">Course</Label>
              <Controller
                name="lesson_id"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      handleCourseChange(value)
                    }}
                    disabled={courses.length === 0}
                  >
                    <SelectTrigger className="w-full" id="exam-course">
                      <SelectValue placeholder="Select a course…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Select a course…</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.lesson_id && (
                <p className="text-xs text-destructive">{form.formState.errors.lesson_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-lesson">Lesson</Label>
              <Controller
                name="lesson_id"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingLessons || !form.getValues("lesson_id")}
                  >
                    <SelectTrigger className="w-full" id="exam-lesson">
                      <SelectValue placeholder={loadingLessons ? "Loading lessons…" : lessons.length === 0 ? "No lessons in this course" : "Select a lesson…"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Select a lesson…</SelectItem>
                      {lessons.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-type">Exam type</Label>
              <Controller
                name="exam_type"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" id="exam-type">
                      <SelectValue placeholder={field.value === "multiple_choice" ? "Select an exam type…" : field.value} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="enumeration">Enumeration</SelectItem>
                      <SelectItem value="identification">Identification</SelectItem>
                      <SelectItem value="true_false">True / False</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-title">Exam title</Label>
              <Input
                id="exam-title"
                {...form.register("title")}
                placeholder="e.g. Midterm Examination"
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exam-description">Description (optional)</Label>
              <textarea
                id="exam-description"
                {...form.register("description")}
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
                  {...form.register("time_limit_minutes")}
                />
                {form.formState.errors.time_limit_minutes && (
                  <p className="text-xs text-destructive">{form.formState.errors.time_limit_minutes.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-attempts">Max attempts</Label>
                <Input
                  id="exam-attempts"
                  type="number"
                  min="1"
                  {...form.register("max_attempts")}
                />
                {form.formState.errors.max_attempts && (
                  <p className="text-xs text-destructive">{form.formState.errors.max_attempts.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-grade">Passing %</Label>
                <Input
                  id="exam-grade"
                  type="number"
                  min="0"
                  max="100"
                  {...form.register("passing_grade")}
                />
                {form.formState.errors.passing_grade && (
                  <p className="text-xs text-destructive">{form.formState.errors.passing_grade.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Create exam
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
