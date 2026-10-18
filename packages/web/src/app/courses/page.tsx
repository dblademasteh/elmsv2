'use client'

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, Grid, List, ArrowRight, Play, Star, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { courseApi } from "@/lib/api"

const LEVELS = ["All levels", "Beginner", "Intermediate", "Advanced"]
const PRICES = ["All prices", "Free", "Under $50", "$50 - $100", "Over $100"]

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>}>
      <CoursesContent />
    </Suspense>
  )
}

function CoursesContent() {
  const [courses, setCourses] = useState<any[]>([])
  const [level, setLevel] = useState("All levels")
  const [price, setPrice] = useState("All prices")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [loading, setLoading] = useState(false)

  const searchParams = useSearchParams()

  useEffect(() => {
    loadCourses()
  }, [])

  // Sync URL search param to local state
  useEffect(() => {
    const q = searchParams.get("q")
    if (q) setSearch(q)
  }, [searchParams])

  async function loadCourses() {
    setLoading(true)
    try {
      const response = await courseApi.list()
      if (response.data) {
        setCourses(response.data)
      }
    } catch {
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
    const matchesLevel = level === "All levels" || c.level === level
    const matchesPrice =
      price === "All prices" ||
      (price === "Free" && c.price_cents === 0) ||
      (price === "Under $50" && c.price_cents > 0 && c.price_cents < 5000) ||
      (price === "$50 - $100" && c.price_cents >= 5000 && c.price_cents <= 10000) ||
      (price === "Over $100" && c.price_cents > 10000)
    return matchesSearch && matchesLevel && matchesPrice
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (filteredCourses.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mx-auto mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No courses found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-background sticky top-0 z-20">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary-600" />
            <span className="text-xl font-bold tracking-tight text-foreground">
              Learn<span className="text-primary-600">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <input
              type="search"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="hidden sm:block w-64 rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("grid")}
                className={`flex items-center gap-2 px-3 ${view === "grid" ? "bg-muted" : ""}`}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("list")}
                className={`flex items-center gap-2 px-3 ${view === "list" ? "bg-muted" : ""}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="px-4 py-8 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center mb-8">
            <div className="flex items-center gap-3">
              <Label htmlFor="level" className="text-xs font-medium text-muted-foreground">
                Level
              </Label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="price" className="text-xs font-medium text-muted-foreground">
                Price
              </Label>
              <select
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PRICES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => (
                <Card
                  key={course.id}
                  className="overflow-hidden hover:shadow-xl transition-shadow group"
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button variant="ghost" size="icon" className="bg-background/90 backdrop-blur">
                        <Play className="h-5 w-5 text-primary-600" />
                      </Button>
                    </div>
                  </div>
                  <CardHeader className="p-5 pt-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <span>{course.level}</span>
                      <span className="mx-1 h-1 w-1 rounded-full bg-muted-foreground/20" />
                      <span>{course.estimated_minutes} min</span>
                    </div>
                    <CardTitle className="text-base leading-snug group-hover:text-primary-600 transition-colors">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 text-sm">
                      {course.short_description || course.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="p-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary-600">
                        ${(course.price_cents / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {course.enrollment_count} students
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-current text-warning/50" />
                      <span className="font-medium text-foreground">
                        {course.rating_average.toFixed(1)}
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCourses.map((course) => (
                <Card key={course.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-12 gap-0 p-0">
                    <div
                      className="col-span-4 aspect-video bg-muted relative overflow-hidden"
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button variant="ghost" size="icon" className="bg-background/90 backdrop-blur">
                          <Play className="h-5 w-5 text-primary-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-8 p-5">
                      <CardHeader className="p-0 mb-2">
                        <CardTitle className="text-base leading-snug group-hover:text-primary-600 transition-colors">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {course.short_description || course.description}
                        </CardDescription>
                      </CardHeader>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-medium text-primary-600">
                          ${(course.price_cents / 100).toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {course.enrollment_count} students
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-current text-warning/50" />
                        <span className="font-medium text-foreground">
                          {course.rating_average.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
