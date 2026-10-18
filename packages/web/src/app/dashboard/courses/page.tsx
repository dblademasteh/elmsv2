'use client'

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAuthStore } from "@/store/auth"
import { courseApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BookOpen, Loader2, Pencil, Plus, Rocket, Archive } from "lucide-react"

type ManagedCourse = {
  id: string
  title: string
  short_description?: string | null
  description?: string | null
  price_cents: number
  currency: string
  level: string
  enrollment_count: number
  rating_average: number
  is_featured?: boolean
  status?: string
}

const LEVELS = ["beginner", "intermediate", "advanced"]

type CourseForm = {
  title: string
  short_description: string
  description: string
  level: string
  price: string
  is_featured: boolean
  is_private: boolean
}

const EMPTY_FORM: CourseForm = {
  title: "",
  short_description: "",
  description: "",
  level: "beginner",
  price: "0",
  is_featured: false,
  is_private: false,
}

function StatusBadge({ status }: { status?: string }) {
  const published = status === "published"
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${
        published
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  )
}

export default function DashboardCoursesPage() {
  const { user } = useAuthStore()
  const isManager = user?.role === "admin" || user?.role === "instructor"
  const [courses, setCourses] = useState<ManagedCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedCourse | null>(null)
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await courseApi.list(
        isManager ? { mine: true, limit: 50 } : { limit: 50 }
      )
      if (response.data) {
        setCourses(response.data)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [isManager])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(course: ManagedCourse) {
    setEditing(course)
    setForm({
      title: course.title,
      short_description: course.short_description ?? "",
      description: course.description ?? "",
      level: course.level || "beginner",
      price: (course.price_cents / 100).toFixed(2),
      is_featured: course.is_featured ?? false,
      is_private: false,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (form.title.trim().length < 3) {
      setFormError("Title must be at least 3 characters.")
      return
    }
    const price = Number.parseFloat(form.price)
    if (Number.isNaN(price) || price < 0) {
      setFormError("Price must be a non-negative number.")
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      title: form.title.trim(),
      short_description: form.short_description.trim() || undefined,
      description: form.description.trim() || undefined,
      level: form.level,
      price_cents: Math.round(price * 100),
      is_featured: form.is_featured,
      is_private: form.is_private,
    }
    const response = editing
      ? await courseApi.update(editing.id, payload)
      : await courseApi.create(payload)
    setSaving(false)
    if (response.error) {
      setFormError(response.error)
      return
    }
    setDialogOpen(false)
    load()
  }

  async function togglePublish(course: ManagedCourse) {
    const next = course.status === "published" ? "draft" : "published"
    setBusyId(course.id)
    await courseApi.update(course.id, { status: next })
    setBusyId(null)
    load()
  }

  async function handleArchive(course: ManagedCourse) {
    if (!window.confirm(`Archive "${course.title}"? It will be hidden from the catalog.`)) {
      return
    }
    setBusyId(course.id)
    await courseApi.archive(course.id)
    setBusyId(null)
    load()
  }

  if (!isManager) {
    // Students get a simple catalog-style view.
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Courses</h1>
            <Button asChild>
              <Link href="/courses">View Catalog</Link>
            </Button>
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl border border-border bg-card" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>No courses available.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {course.short_description || course.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-between items-center">
                    <span className="text-sm capitalize text-muted-foreground">{course.level}</span>
                    <Button size="sm" asChild>
                      <Link href={`/courses/${course.id}`}>View</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">My Courses</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/courses">View Catalog</Link>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Course
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-medium">Courses aren't available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-4 font-medium">You haven't created any courses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first course to start building lessons and quizzes.
            </p>
            <Button className="mt-6" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Course
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Enrolled</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {course.title}
                        {course.is_featured && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                            Featured
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {course.short_description || course.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{course.level}</td>
                    <td className="px-4 py-3">
                      {course.price_cents === 0
                        ? "Free"
                        : new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: course.currency || "USD",
                          }).format(course.price_cents / 100)}
                    </td>
                    <td className="px-4 py-3">{course.enrollment_count}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={course.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(course)}
                          disabled={busyId === course.id}
                          aria-label={`Edit ${course.title}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePublish(course)}
                          disabled={busyId === course.id}
                          aria-label={
                            course.status === "published"
                              ? `Unpublish ${course.title}`
                              : `Publish ${course.title}`
                          }
                        >
                          {busyId === course.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Rocket className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span className="ml-1.5">
                            {course.status === "published" ? "Unpublish" : "Publish"}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(course)}
                          disabled={busyId === course.id}
                          className="text-destructive hover:text-destructive"
                          aria-label={`Archive ${course.title}`}
                        >
                          <Archive className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update the course details, then publish when ready."
                  : "Courses start as drafts — add lessons and publish when ready."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="course-title">Title</Label>
                <Input
                  id="course-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Introduction to TypeScript"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-short">Short description</Label>
                <Input
                  id="course-short"
                  value={form.short_description}
                  onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  placeholder="One-line summary shown on cards"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-description">Description</Label>
                <textarea
                  id="course-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="What will students learn?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="course-level">Level</Label>
                  <select
                    id="course-level"
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="course-price">Price (USD)</Label>
                  <Input
                    id="course-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
              </div>
              {user?.role === "admin" && (
                <div className="flex items-center gap-2">
                  <input
                    id="course-featured"
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="course-featured">Featured on the landing page</Label>
                </div>
              )}
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {editing ? "Save changes" : "Create course"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
