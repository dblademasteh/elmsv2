'use client'

import { useAuthStore } from "@/store/auth"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { GraduationCap, Clock, BookOpen } from "lucide-react"

export default function DashboardLearningPage() {
  const { user } = useAuthStore()
  const [progress, setProgress] = useState<any[]>([])

  useEffect(() => {
    setProgress([
      { course: "Introduction to React", progress: 75, completed: 12, total: 16 },
      { course: "Advanced TypeScript", progress: 30, completed: 4, total: 14 },
      { course: "Node.js Fundamentals", progress: 0, completed: 0, total: 10 },
    ])
  }, [])

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">My Learning</h1>
        <div className="grid gap-6 lg:grid-cols-3">
          {progress.map((c) => (
            <div key={c.course} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-primary">
                  {Math.round(c.progress)}%
                </span>
              </div>
              <h3 className="font-semibold mb-2">{c.course}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {c.completed} of {c.total} lessons completed
              </p>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${c.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
