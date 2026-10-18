'use client'

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Play,
  BookOpen,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Star,
  FileText,
  HelpCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { courseApi, lessonApi, quizApi, enrollmentApi, reviewApi, assignmentApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

interface LessonAssignment {
  id: string
  lesson_id: string
  title: string
  description?: string | null
  due_date: string | null
  max_score: number
  is_published: boolean
  submission_count: number
  graded_count: number
  status?: string
}

interface Lesson {
  id: string
  title: string
  description?: string
  position: number
  content_type: string
  video_url?: string
  duration_seconds?: number
  estimated_minutes?: number
  is_published: boolean
  published_at?: string
}

interface Quiz {
  id: string
  title: string
  questions: Array<Record<string, unknown>>
  time_limit_seconds?: number | null
  max_attempts: number
  passing_grade: number
}

interface MySubmission {
  assignment_id: string
  score: number | null
  max_score: number
  score_percentage: number | null
  status: string
  feedback: string | null
  is_late: boolean
  submitted_at: string | null
  file_url: string | null
  file_name: string | null
}

interface CourseDetail {
  id: string
  title: string
  description?: string | null
  slug: string
  level: string
  status: string
  cover_image_url?: string | null
  learning_objectives?: string | null
  prerequisites?: string | null
  instructor_id?: string | null
  is_featured: boolean
  enrollment_count: number
  rating_average: number
  rating_count: number
}

interface MyEnrollment {
  id: string
  course_id: string
  course_title: string
  course_level: string
  course_cover_image_url: string | null
  enrolled_at: string
  progress_percent: number
  status: string
}

export default function CourseLearnPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = typeof params?.id === "string" ? params.id : ""
  const { user, token, isAuthenticated } = useAuthStore()

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [assignments, setAssignments] = useState<LessonAssignment[]>([])
  const [mySubmissions, setMySubmissions] = useState<Record<string, MySubmission>>({})
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [enrollment, setEnrollment] = useState<MyEnrollment | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeContent, setActiveContent] = useState<"lesson" | "quiz">("lesson")

  const loadCourse = useCallback(async () => {
    if (!courseId) return

    setLoading(true)
    try {
      // Load course detail
      const courseResp = await courseApi.getDetail(courseId)
      if (courseResp.data) {
        setCourse(courseResp.data as unknown as CourseDetail)
      }

      // Load lessons
      const lessonsResp = await lessonApi.listByCourse(courseId)
      if (lessonsResp.data) {
        const sortedLessons = (lessonsResp.data as unknown as Lesson[])
          .filter(l => l.is_published)
          .sort((a, b) => a.position - b.position)
        setLessons(sortedLessons)
      }

      // Load quizzes for the course
      const quizzesResp = await quizApi.getByCourse(courseId)
      if (quizzesResp.data) {
        setQuizzes(quizzesResp.data as unknown as Quiz[])
      }

      // Load assignments for the course
      const assignmentsResp = await assignmentApi.getByCourse(courseId)
      if (assignmentsResp.data) {
        setAssignments(assignmentsResp.data as unknown as LessonAssignment[])
      }

      // Load student submissions
      const submissionsResp = await assignmentApi.getMySubmissions()
      if (submissionsResp.data) {
        const subs: Record<string, MySubmission> = {}
        for (const s of submissionsResp.data as unknown as MySubmission[]) {
          subs[s.assignment_id] = s
        }
        setMySubmissions(subs)
      }

      // Find enrollment
      const enrollResp = await enrollmentApi.getMyEnrollments()
      if (enrollResp.data) {
        const myEnrollment = (enrollResp.data as unknown as MyEnrollment[]).find(
          e => e.course_id === courseId
        )
        if (myEnrollment) {
          setEnrollment(myEnrollment)
        }
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login")
      return
    }
    loadCourse()
  }, [courseId, isAuthenticated(), loadCourse])

  const currentLesson = lessons[currentLessonIndex]
  const lessonQuizzes = quizzes.filter(q => {
    // Quizzed lessons would have the quiz linked via lesson_id
    return true
  })

  function handleLessonComplete() {
    // In a full implementation, this would update progress
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1)
    } else {
      // Show completion
      alert("Congratulations! You've completed all lessons in this course.")
    }
  }

  function nextLesson() {
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1)
    }
  }

  function prevLesson() {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading course...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!course) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-center">Course not found or not enrolled.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/learning">
              <Button size="sm" variant="ghost" className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                My Learning
              </Button>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{course.title}</span>
          </div>
          {enrollment && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Progress: {Math.round(enrollment.progress_percent)}%
              </span>
              <div className="w-24">
                <Progress value={enrollment.progress_percent} className="h-2" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar - Lessons */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Course Content
              </h2>
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setCurrentLessonIndex(index)
                    setActiveContent("lesson")
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    currentLessonIndex === index
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded ${
                      currentLessonIndex === index
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="truncate">{lesson.title}</span>
                  {lesson.estimated_minutes && (
                    <Clock className="h-3 w-3 ml-auto text-muted-foreground/50" />
                  )}
                </button>
              ))}

              {/* Quizzes in sidebar */}
              {lessonQuizzes.length > 0 && (
                <>
                  <div className="pt-3 mt-3 border-t border-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Quizzes
                    </h3>
                    {lessonQuizzes.map((quiz) => (
                      <button
                        key={quiz.id}
                        onClick={() => {
                          setActiveContent("quiz")
                          // In full implementation, load quiz by ID
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="truncate">{quiz.title}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Assignments in sidebar */}
              {assignments.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Assignments
                  </h3>
                  {assignments.filter(a => a.is_published).map((a) => {
                    const submission = mySubmissions[a.id]
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          window.open(`/dashboard/courses/${courseId}/assignments`, "_blank")
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{a.title}</span>
                          {submission && (
                            <span className={`text-xs ${
                              submission.score !== null ? "text-green-500" : "text-yellow-500"
                            }`}>
                              {submission.score !== null
                                ? `${submission.score}/${a.max_score}`
                                : "Pending review"}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeContent === "lesson" && currentLesson ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      Lesson {currentLesson.position + 1}: {currentLesson.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {currentLesson.estimated_minutes && (
                        <span className="text-xs text-muted-foreground">
                          {currentLesson.estimated_minutes} min
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Video player */}
                  {currentLesson.content_type === "video" && currentLesson.video_url ? (
                    <div className="aspect-video rounded-lg bg-muted overflow-hidden">
                      <iframe
                        src={currentLesson.video_url}
                        title={currentLesson.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : currentLesson.content_type === "video" ? (
                    <div className="aspect-video rounded-lg bg-muted border border-border flex items-center justify-center">
                      <Play className="h-12 w-12 text-muted-foreground" />
                    </div>
                  ) : null}

                  {/* Content */}
                  {currentLesson.description && (
                    <p className="text-muted-foreground">{currentLesson.description}</p>
                  )}

                  {/* Lesson body */}
                  <div className="prose prose-sm max-w-none pt-4">
                    <h3 className="text-lg font-semibold">Lesson Content</h3>
                    <p className="text-muted-foreground">
                      This is where the lesson content for "{currentLesson.title}" would be displayed.
                      {currentLesson.content_type === "video" && " This lesson contains a video."}
                      {currentLesson.content_type === "text" && " This lesson contains text content."}
                      {currentLesson.content_type === "quiz" && " This lesson includes a quiz."}
                      {currentLesson.content_type === "assignment" && " This lesson includes an assignment."}
                    </p>
                  </div>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-between items-center">
                  <Button variant="outline" onClick={prevLesson} disabled={currentLessonIndex === 0}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button onClick={handleLessonComplete}>
                    Mark as Complete
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </Button>
                  {currentLessonIndex < lessons.length - 1 && (
                    <Button variant="outline" onClick={nextLesson}>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Select a lesson to start learning</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Choose a lesson from the sidebar to begin.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Rating & Review Summary */}
        {course.rating_count > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Course Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{course.rating_average.toFixed(1)}</div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      style={{
                        fill: i < Math.round(course.rating_average) ? "#eab308" : "none",
                        color: i < Math.round(course.rating_average) ? "#eab308" : "#ddd",
                      }}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground">
                  {course.rating_count} {course.rating_count === 1 ? "review" : "reviews"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
