'use client'

import { useParams } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowRight, Play, Star, Clock, Users, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { authApi, courseApi } from "@/lib/api"

export default function CoursePage() {
  const params = useParams()
  const courseId = typeof params?.id === "string" ? params.id : ""
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const objectives = typeof course?.learning_objectives === "string"
    ? course.learning_objectives.split(/\r?\n/).map((item: string) => item.trim()).filter(Boolean)
    : []

  const loadCourse = useCallback(async () => {
    setLoading(true)
    try {
      const response = await courseApi.get(courseId)
      if (response.data) {
        setCourse(response.data)
      }
    } catch {
      setCourse(null)
    } finally {
      setLoading(false)
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

                  <Button size="lg" asChild className="w-full py-4 text-base font-medium">
                    <Link href="/register">Create an account</Link>
                  </Button>
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
                          ${(course.price_cents / 100).toFixed(2)}
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
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 flex items-center justify-between group hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                          <span className="text-sm text-foreground">
                            Lesson {i}: Getting started
                          </span>
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
