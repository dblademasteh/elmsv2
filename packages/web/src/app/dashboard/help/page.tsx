'use client'

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { HelpCircle } from "lucide-react"

export default function DashboardHelpPage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Help Center</h1>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-2">
            <div className="border-b border-border pb-3">
              <p className="font-medium mb-1">How do I enroll in a course?</p>
              <p className="text-sm text-muted-foreground">
                Browse the course catalog and click "Enroll" on any course you wish to join.
              </p>
            </div>
            <div className="border-b border-border pb-3">
              <p className="font-medium mb-1">How do I track my progress?</p>
              <p className="text-sm text-muted-foreground">
                Visit the "My Learning" section to see your course progress and completion status.
              </p>
            </div>
            <div className="border-b border-border pb-3">
              <p className="font-medium mb-1">Who can access user management?</p>
              <p className="text-sm text-muted-foreground">
                User management is available to administrators and instructors only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
