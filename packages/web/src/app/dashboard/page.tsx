'use client'

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  Clock,
  DollarSign,
  GraduationCap,
  Loader2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useAuthStore } from "@/store/auth"
import { courseApi } from "@/lib/api"

type DashboardCourse = {
  id: string
  title: string
  short_description?: string | null
  description?: string | null
  level: string
  enrollment_count: number
  price_cents: number
  currency: string
}

type StatCard = {
  title: string
  value: string
  change: string
  icon: React.ComponentType<{ className?: string }>
  trend: "up" | "down" | "neutral"
}

interface TrendIndicatorProps {
  trend: "up" | "down" | "neutral"
  className?: string
}

const TrendIndicator = ({ trend, className }: TrendIndicatorProps) => {
  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
      ? "text-red-500"
      : "text-muted-foreground"
  const trendSymbol = trend === "up" ? "↗" : trend === "down" ? "↘" : "→"

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor} ${className || ""}`}
      aria-label={`Trend: ${trend}`}
    >
      {trendSymbol}
    </span>
  )
}

function StatCard({ stat }: { stat: StatCard }) {
  return (
    <Card className="border-border transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {stat.value}
            </p>
            <div className="flex items-center gap-1.5">
              <TrendIndicator trend={stat.trend} />
              <span className="text-xs text-muted-foreground">
                {stat.change}
              </span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <stat.icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-7 w-14 rounded mt-1" />
            <Skeleton className="h-3 w-32 rounded mt-1.5" />
          </div>
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}

function CourseCardSkeleton() {
  return (
    <Card className="h-full border-border">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-6 rounded-lg" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <CardHeader className="flex-1 p-5 pb-3">
        <Skeleton className="h-5 w-full rounded" />
        <Skeleton className="h-4 w-full rounded mt-2" />
        <Skeleton className="h-4 w-3/4 rounded mt-2" />
      </CardHeader>
      <CardContent className="flex items-center justify-between border-t border-border p-5">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </CardContent>
      <div className="border-t border-border p-5 pt-3">
        <Skeleton className="h-4 w-full rounded" />
      </div>
    </Card>
  )
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100)
}

function CourseCard({ course }: { course: DashboardCourse }) {
  return (
    <Card
      className="group flex h-full flex-col overflow-hidden rounded-xl border-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      tabIndex={-1}
    >
      <div className="relative flex aspect-[2.4/1] items-end bg-gradient-to-br from-primary/15 via-muted to-primary/5 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-background/80 bg-card/90 text-primary shadow-sm">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="absolute top-3 right-3 rounded-full bg-background/90 px-2 py-1 text-xs font-semibold text-primary">
          {course.level}
        </div>
      </div>
      <CardHeader className="flex-1 p-5 pb-3">
        <CardTitle className="text-base leading-snug transition-colors group-hover:text-primary">
          {course.title}
        </CardTitle>
        <CardDescription
          className="mt-2 line-clamp-2 leading-5"
          title={course.short_description || course.description || ""}
        >
          {course.short_description || course.description || "Explore this course and see if it fits your goals."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between border-t border-border p-5 text-sm">
        <span className="font-semibold text-foreground">
          {formatPrice(course.price_cents, course.currency)}
        </span>
        <span className="text-xs text-muted-foreground">
          {course.enrollment_count} enrolled
        </span>
      </CardContent>
      <div className="border-t border-border p-5 pt-3">
        <Link
          href={`/courses/${course.id}`}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          View course details
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </Link>
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [courses, setCourses] = useState<DashboardCourse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let active = true

    courseApi
      .list({ limit: 6 })
      .then((response) => {
        if (!active) return
        if (response.data) {
          setCourses(response.data)
        } else {
          setHasError(true)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (!active) return
        setHasError(true)
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Role-based stats (memoized for perf)
  const stats = useMemo<StatCard[]>(() => {
    const baseStats: StatCard[] = [
      {
        title: "Total Courses",
        value: "12",
        change: "+2 this month",
        icon: BookOpen,
        trend: "up",
      },
    ]

    if (user?.role === "admin") {
      return [
        ...baseStats,
        {
          title: "Active Users",
          value: "1,284",
          change: "+12% from last month",
          icon: Users,
          trend: "up",
        },
        {
          title: "Completions",
          value: "342",
          change: "+8% from last month",
          icon: GraduationCap,
          trend: "up",
        },
        {
          title: "Revenue",
          value: "$5,420",
          change: "+15% from last month",
          icon: DollarSign,
          trend: "up",
        },
      ]
    }

    if (user?.role === "instructor") {
      return [
        ...baseStats,
        {
          title: "Students Taught",
          value: "342",
          change: "+5% from last month",
          icon: UserPlus,
          trend: "up",
        },
        {
          title: "Completions",
          value: "89",
          change: "+3% from last month",
          icon: GraduationCap,
          trend: "neutral",
        },
        {
          title: "Avg. Rating",
          value: "4.8",
          change: "Stable",
          icon: TrendingUp,
          trend: "neutral",
        },
      ]
    }

    return [
      {
        title: "Enrolled Courses",
        value: "3",
        change: "In progress",
        icon: BookOpen,
        trend: "neutral",
      },
      {
        title: "Hours Learned",
        value: "24.5",
        change: "+2.1 this week",
        icon: Clock,
        trend: "up",
      },
      {
        title: "Completed",
        value: "1",
        change: "1 course done",
        icon: GraduationCap,
        trend: "neutral",
      },
      {
        title: "Current Streak",
        value: "5 days",
        change: "Keep going!",
        icon: TrendingUp,
        trend: "up",
      },
    ]
  }, [user?.role])

  const firstName = user?.full_name?.trim().split(/\s+/)[0] || "there"

  if (!mounted) return null

  return (
    <DashboardLayout>
      <main className="pb-10" tabIndex={-1}>
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Welcome Hero */}
          <section
            className="relative isolate overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-9 sm:py-10"
            aria-label="Welcome"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-1/2 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.12),transparent_68%)] sm:block"
            />
            <div className="relative max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                YOUR LEARNING SPACE
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Good to see you, {firstName}.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Find a subject that interests you and take the next step at your own pace.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 gap-2 rounded-lg px-5">
                  <Link href="/courses">
                    Explore courses
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-lg px-5">
                  <Link href="/">Visit learning home</Link>
                </Button>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="absolute -bottom-12 -right-10 hidden h-52 w-52 items-center justify-center rounded-full border border-primary/10 sm:flex"
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/5 text-primary/70">
                <GraduationCap className="h-14 w-14" strokeWidth={1.25} />
              </div>
            </div>
          </section>

          {/* Stats Grid */}
          <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
              : stats.map((stat) => <StatCard key={stat.title} stat={stat} />)}
          </section>

          {/* Courses Section */}
          <section aria-labelledby="courses-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Keep exploring
                </p>
                <h2
                  id="courses-heading"
                  className="mt-2 text-2xl font-semibold tracking-tight"
                >
                  Courses to explore
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A few published courses from the catalog.
                </p>
              </div>
              <Link
                href="/courses"
                className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                Browse the catalog
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </Link>
            </div>

            {isLoading ? (
              <div
                className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                role="status"
                aria-label="Loading courses"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </div>
            ) : hasError ? (
              <div className="mt-5 rounded-xl border border-border bg-card px-6 py-12 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-4 font-medium">Courses aren't available right now.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can still browse the catalog or try again later.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/courses">Open course catalog</Link>
                </Button>
              </div>
            ) : courses.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-4 font-medium">No published courses yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Check back when new courses become available.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>

          {/* Recent Activity */}
          <section aria-labelledby="activity-heading">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Recent Activity
              </p>
              <h2
                id="activity-heading"
                className="mt-2 text-2xl font-semibold tracking-tight"
              >
                Your learning activity
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Track your progress and recent interactions.
              </p>
            </div>
            <Card className="mt-4 border-border">
              <CardContent className="py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No activity to show yet. Start exploring courses to get started!
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href="/courses">Browse courses</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </DashboardLayout>
  )
}
