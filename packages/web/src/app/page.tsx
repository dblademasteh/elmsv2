'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Loader2,
  Globe,
  BarChart3,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { courseApi } from "@/lib/api"
import { LandingAppBar } from "@/components/layout/landing-appbar"

type Course = {
  id: string
  title: string
  short_description?: string | null
  description?: string | null
  price_cents: number
  currency: string
  enrollment_count: number
  level: string
  rating_average: number
}

type Feature = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

type Testimonial = {
  name: string
  role: string
  content: string
  avatar: string
}

const features: Feature[] = [
  {
    icon: GraduationCap,
    title: "Expert Instruction",
    description: "Learn from industry professionals who are passionate about teaching.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description: "Track your learning journey with detailed analytics and insights.",
  },
  {
    icon: Globe,
    title: "Global Community",
    description: "Join learners from around the world in collaborative courses.",
  },
  {
    icon: Clock,
    title: "Self-Paced",
    description: "Learn on your schedule with flexible, on-demand content.",
  },
]

const testimonials: Testimonial[] = [
  {
    name: "Sarah Chen",
    role: "UX Designer",
    content: "Learn. transformed my career. The courses are practical and the community is supportive.",
    avatar: "SC",
  },
  {
    name: "Marcus Johnson",
    role: "Data Scientist",
    content: "I've taken courses from many platforms. This one stands out for its quality.",
    avatar: "MJ",
  },
  {
    name: "Priya Patel",
    role: "Frontend Developer",
    content: "The hands-on projects gave me real skills I use every day at work.",
    avatar: "PP",
  },
]

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100)
}

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    courseApi.list({ limit: 4 }).then((response) => {
      if (!active) return
      if (response.data) {
        setCourses(response.data)
      } else {
        setLoadError(true)
      }
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setLoadError(true)
      setLoading(false)
    })

    return () => { active = false }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingAppBar />
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden border-b border-border bg-muted/30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.10),transparent_46%)]"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3.5 py-1.5 text-sm font-medium text-primary shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              A clear place to keep learning
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Find your next subject. <span className="text-primary">Start at your pace.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Explore available courses, compare the details, and choose what you want to learn next.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="h-12 rounded-lg px-6">
                <Link href="/courses">
                  Browse courses{" "}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 rounded-lg px-6">
                <Link href="/register">Create an account</Link>
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              {["Course details up front", "Browse before you sign up"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
            <div
              aria-hidden="true"
              className="absolute -inset-5 rounded-[2rem] bg-primary/5 blur-2xl"
            />
            <div className="relative rounded-2xl border border-border bg-card p-5 shadow-xl shadow-foreground/5 sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div>
                  <p className="text-sm font-semibold">A thoughtful way to learn</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Three simple steps
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <div className="divide-y divide-border">
                {[
                  { icon: BookOpen, title: "Explore the catalog", desc: "Browse the courses currently available on the platform.", num: "01" },
                  { icon: BarChart3, title: "Find a good fit", desc: "Review each course description, level, and price before you choose.", num: "02" },
                  { icon: GraduationCap, title: "Join the learning space", desc: "Create an account to get started with Learn.", num: "03" },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4 py-5 last:pb-1">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-wider text-primary">
                        {step.num}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{step.title}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to learn
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Our platform offers a comprehensive learning experience designed
            for modern learners.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <feature.icon className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              What learners say
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Join thousands of learners who have transformed their careers.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm leading-6 text-muted-foreground">
                    "{testimonial.content}"
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Course Catalog */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              Course catalog
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Explore what's available.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Courses currently published on the platform.
            </p>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            Browse all courses
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div
            className="mt-10 flex min-h-48 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Loading courses...
          </div>
        ) : loadError ? (
          <div className="mt-10 rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="font-medium">Courses aren't available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Please try again in a little while.
            </p>
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-4 font-medium">No published courses yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back when new courses become available.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Link
                  href={`/courses/${course.id}`}
                  className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div className="flex aspect-[16/10] items-end bg-gradient-to-br from-primary/15 via-muted to-primary/5 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-background/80 bg-card/90 text-primary shadow-sm">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                  <CardHeader className="flex-1 p-5 pb-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{course.level}</span>
                      <span>{course.enrollment_count} enrolled</span>
                    </div>
                    <CardTitle className="text-base leading-snug transition-colors group-hover:text-primary">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="mt-2 line-clamp-3 text-sm leading-5">
                      {course.short_description ||
                        course.description ||
                        "Explore this course and see if it fits your goals."}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="justify-between border-t border-border p-5 text-sm">
                    <span className="font-semibold text-foreground">
                      {formatPrice(course.price_cents, course.currency)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      View course
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </CardFooter>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-primary py-20 text-center text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to start learning?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/85">
            Join thousands of learners and start building the skills you need.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
            <Button size="lg" variant="secondary" asChild className="h-12 rounded-lg px-8">
              <Link href="/register">Get started for free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 rounded-lg px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/courses">Browse courses</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-primary-foreground/70">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>
    </div>
  )
}
