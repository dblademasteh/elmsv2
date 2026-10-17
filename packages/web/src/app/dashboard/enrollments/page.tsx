'use client'

import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ShoppingCart } from "lucide-react"

export default function DashboardEnrollmentsPage() {
  const { user } = useAuthStore()

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold">Enrollment Requests</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">You do not have access to enrollment management.</p>
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
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Enrollment Requests</h1>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted text-muted-foreground">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">Jane Doe</td>
                <td className="px-4 py-3">Introduction to React</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">2 hours ago</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
                    Pending
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-sm text-primary hover:underline">Approve</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
