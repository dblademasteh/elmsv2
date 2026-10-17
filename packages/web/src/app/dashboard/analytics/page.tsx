'use client'

import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { BarChart3 } from "lucide-react"

export default function DashboardAnalyticsPage() {
  const { user } = useAuthStore()

  if (user?.role !== "admin" && user?.role !== "instructor") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">You do not have access to analytics.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Analytics</h1>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Course Enrollments</h3>
            <div className="h-48 w-full bg-muted/50 rounded-lg border border-border">
              <div className="flex items-end h-full gap-1 p-4">
                <div className="flex-1 bg-primary/60 rounded-t"></div>
                <div className="flex-1 bg-primary/40 rounded-t"></div>
                <div className="flex-1 bg-primary rounded-t"></div>
                <div className="flex-1 bg-primary/80 rounded-t"></div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Course Completions</h3>
            <div className="h-48 w-full bg-muted/50 rounded-lg border border-border">
              <div className="flex items-end h-full gap-1 p-4">
                <div className="flex-1 bg-emerald-100 rounded-t"></div>
                <div className="flex-1 bg-emerald-200 rounded-t"></div>
                <div className="flex-1 bg-emerald-300 rounded-t"></div>
                <div className="flex-1 bg-emerald-400 rounded-t"></div>
                <div className="flex-1 bg-emerald-500 rounded-t"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
