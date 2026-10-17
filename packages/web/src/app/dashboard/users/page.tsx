'use client'

import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Users } from "lucide-react"

export default function DashboardUsersPage() {
  const { user } = useAuthStore()

  if (user?.role !== "admin" && user?.role !== "instructor") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold">Users</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">You do not have access to user management.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const mockUsers = [
    { name: "Admin User", email: "admin@lms.com", role: "admin", status: "Active" },
    { name: "Instructor One", email: "instructor@lms.com", role: "instructor", status: "Active" },
    { name: "Student One", email: "student@lms.com", role: "student", status: "Active" },
  ]

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Users</h1>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockUsers.map((u) => (
                <tr key={u.email} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-muted/50">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
