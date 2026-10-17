'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuthStore } from "@/store/auth"
import { courseApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { BookOpen } from "lucide-react"

export default function DashboardCoursesPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    courseApi.list({ limit: 50 }).then((response) => {
      if (response.data) setCourses(response.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (!loading && courses.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Courses</h1>
            <Button asChild>
              <Link href="/courses">View Catalog</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p>No courses available.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Courses</h1>
          <Button asChild>
            <Link href="/courses">View Catalog</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 rounded-xl border border-border bg-card"></div>
              ))
            : courses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription>{course.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{course.level}</span>
                    <Button size="sm" asChild>
                      <Link href={`/courses/${course.id}`}>View</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
