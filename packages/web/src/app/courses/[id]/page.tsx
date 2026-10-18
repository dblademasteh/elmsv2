'use client'

import { useParams } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowRight, Play, Star, Clock, Users, BookOpen, Loader2, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { authApi, courseApi, enrollmentApi, reviewApi, lessonApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency } from "@/lib/format"
import { CourseDiscussions } from "@/components/discussions/course-discussions"

export default function CoursePage() {
  const params = useParams()
  const courseId = typeof params?.id === "string" ? params.id : ""
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [ratingSummary, setRatingSummary] = useState<any>(null)
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewFormData, setReviewFormData] = useState({
    rating_content: 5,
    rating_instructor: 5,
    rating_value: 5,
    title: "",
    review: "",
  })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [syllabus, setSyllabus] = useState<Array<{ id: string; title: string; section_title: string | null }>>([])
  const [loadingSyllabus, setLoadingSyllabus] = useState(true)
  const { user, token, isAuthenticated } = useAuthStore()

  const objectives = typeof course?.learning_objectives === "string"
    ? course.learning_objectives.split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean)
    : []

  const loadCourse = useCallback(async () => {
    setLoading(true)
    setLoadingReviews(true)
    try {
      const response = await courseApi.getDetail(courseId)
      if (response.data) {
        setCourse(response.data)
      }

      // Load reviews and rating summary
      const reviewsResp = await reviewApi.listByCourse(courseId)
      if (reviewsResp.data) setReviews(reviewsResp.data)

      try {
        const summaryResp = await reviewApi.getRatingSummary(courseId)
        if (summaryResp.data) setRatingSummary(summaryResp.data)
      } catch {
        // Rating summary is optional
      }

      try {
        const lessonsResp = await lessonApi.listByCourse(courseId)
        setSyllabus(
          (lessonsResp.data ?? []).map((l) => ({
            id: l.id,
            title: l.title,
            section_title: l.section_title ?? null,
          }))
        )
      } catch {
        setSyllabus([])
      } finally {
        setLoadingSyllabus(false)
      }
    } catch {
      setCourse(null)
    } finally {
      setLoading(false)
      setLoadingReviews(false)
    }
  }, [courseId])

  useEffect(() => {
    loadCourse()
  }, [loadCourse])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background py-20">
        <Card className="p-8 text-center">
          <CardHeader>
            <CardTitle>Course not found</CardTitle>
            <CardDescription>The course you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/courses">Browse courses</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background sticky top-0 z-20">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <Link
            href="/courses"
            className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
          >
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">Back to courses</span>
          </Link>
        </div>
      </nav>

      <div className="px-4 py-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="aspect-video bg-muted relative overflow-hidden rounded-xl mb-6">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button variant="ghost" size="lg" className="bg-black/40 backdrop-blur-sm">
                    <Play className="h-10 w-10 text-white" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    <span>{course.level}</span>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight mb-4">
                    {course.title}
                  </h1>
                  <p className="text-lg text-muted-foreground mb-6 line-clamp-3">
                    {course.description}
                  </p>

                  <div className="flex items-center gap-6 mb-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {course.enrollment_count} students
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current text-warning/50" />
                      <span className="text-sm font-medium text-foreground">
                        {Number(course.rating_average || 0).toFixed(1)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({course.rating_count} reviews)
                      </span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full py-4 text-base font-medium"
                    disabled={enrolling}
                    onClick={async () => {
                      if (!isAuthenticated()) {
                        window.location.href = "/login"
                        return
                      }
                      setEnrolling(true)
                      setEnrollError(null)
                      const response = await enrollmentApi.enroll(courseId)
                      if (response.error) {
                        setEnrollError(response.error)
                      } else if (response.data) {
                        window.location.href = `/courses/${courseId}/learn`
                      }
                      setEnrolling(false)
                    }}
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                        Enrolling...
                      </>
                    ) : isAuthenticated() ? (
                      <>
                        Enroll now (Free)
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        Enroll now (Free)
                        <LogIn className="ml-2 h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>

                  {enrollError && (
                    <div
                      role="alert"
                      className="mt-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {enrollError}
                    </div>
                  )}
                </div>
                <div className="w-full lg:w-80 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Course details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(course.price_cents, course.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Level</span>
                        <span className="font-medium text-foreground">{course.level}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {objectives.length > 0 && <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">What you'll learn</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {objectives.map((obj: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="h-3 w-3 rounded-full bg-primary/10 text-primary-600 flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span>{obj}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Instructor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {course.instructor_id ? "Instructor" : "Expert Instructor"}
                      </p>
                      <p className="text-xs text-muted-foreground">Course author</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Syllabus</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingSyllabus ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                    </div>
                  ) : syllabus.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      The instructor hasn't published the curriculum yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {syllabus.map((lesson) => (
                        <div key={lesson.id} className="p-4 flex items-center justify-between group hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-2 w-2 shrink-0 rounded-full bg-primary/40" />
                            <span className="text-sm text-foreground truncate">
                              {lesson.section_title && (
                                <span className="text-xs font-semibold uppercase tracking-wide text-primary mr-2">
                                  {lesson.section_title}
                                </span>
                              )}
                              {lesson.title}
                            </span>
                          </div>
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Student Reviews</h2>
              {isAuthenticated() && user?.role === "student" && (
                <Button size="sm" onClick={() => setShowReviewForm(!showReviewForm)}>
                  {showReviewForm ? "Cancel" : "Write a Review"}
                </Button>
              )}
            </div>

            {/* Rating Summary */}
            {!loadingReviews && ratingSummary && (
              <Card className="mb-6">
                <CardContent className="py-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{ratingSummary.overall_average}</div>
                      <div className="text-xs text-muted-foreground">out of 5</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {["5", "4", "3", "2", "1"].map((star) => {
                        const count = ratingSummary.rating_distribution?.[star] || 0
                        const total = ratingSummary.total_reviews || 1
                        const pct = (count / total) * 100
                        return (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-xs w-6">{star}★</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-400 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                                aria-hidden="true"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="text-center">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mx-auto" />
                      <div className="text-sm font-medium mt-1">{ratingSummary.total_reviews} reviews</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Review Form */}
            {showReviewForm && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Write a Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Content</label>
                      <select
                        value={reviewFormData.rating_content}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, rating_content: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{n} stars</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Instructor</label>
                      <select
                        value={reviewFormData.rating_instructor}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, rating_instructor: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{n} stars</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Value</label>
                      <select
                        value={reviewFormData.rating_value}
                        onChange={(e) => setReviewFormData({ ...reviewFormData, rating_value: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{n} stars</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={reviewFormData.title}
                    onChange={(e) => setReviewFormData({ ...reviewFormData, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                  />
                  <textarea
                    placeholder="Your review (optional)"
                    value={reviewFormData.review}
                    onChange={(e) => setReviewFormData({ ...reviewFormData, review: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowReviewForm(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={submittingReview}
                      onClick={async () => {
                        setSubmittingReview(true)
                        const resp = await reviewApi.create(courseId, reviewFormData)
                        if (resp.data) {
                          setReviews([resp.data, ...reviews])
                          setShowReviewForm(false)
                          // Reload summary
                          const summaryResp = await reviewApi.getRatingSummary(courseId)
                          if (summaryResp.data) setRatingSummary(summaryResp.data)
                        } else {
                          alert(resp.error || "Failed to submit review")
                        }
                        setSubmittingReview(false)
                      }}
                    >
                      {submittingReview ? "Submitting..." : "Submit Review"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews List */}
            {loadingReviews ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
                <Star className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                <p>No reviews yet. Be the first to review!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                          {r.user_full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{r.user_full_name || "Anonymous"}</span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                  style={{
                                    fill: i < Math.round(r.average_rating) ? "#eab308" : "none",
                                    color: i < Math.round(r.average_rating) ? "#eab308" : "#ddd",
                                  }}
                                />
                              ))}
                              <span className="text-xs text-muted-foreground">({r.average_rating})</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <h3 className="font-medium text-sm">{r.title}</h3>
                          {r.review && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{r.review}</p>}
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Content: {r.rating_content}/5</span>
                            <span>Instructor: {r.rating_instructor}/5</span>
                            <span>Value: {r.rating_value}/5</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <CourseDiscussions courseId={courseId} />
        </div>
      </div>
    </div>
  )
}
