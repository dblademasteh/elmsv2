'use client'

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { userApi } from "@/lib/api"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  Users,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react"

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_verified: boolean
  is_active: boolean
  created_at: string
}

const roleIcons: Record<string, React.ElementType> = {
  admin: ShieldCheck,
  instructor: ShieldAlert,
  student: Shield,
}

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  instructor: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  student: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  instructor: "Instructor",
  student: "Student",
}

export default function DashboardUsersPage() {
  const { user: currentUser } = useAuthStore()
  const role = currentUser?.role
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError(null)
    const resp = await userApi.list()
    if (resp.data) {
      setUsers(resp.data as User[])
    } else {
      setError(resp.error || "Failed to load users")
    }
    setLoading(false)
  }

  async function updateUser(userId: string, data: { role?: string; is_active?: boolean; is_verified?: boolean }) {
    setUpdating(userId)
    const resp = await userApi.update(userId, data)
    if (resp.data) {
      setUsers(users.map(u => u.id === userId ? { ...u, ...resp.data } as User : u))
    } else {
      alert(resp.error || "Failed to update user")
    }
    setUpdating(null)
  }

  const filtered = users.filter(u => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.is_active : !u.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  if (!currentUser || (role !== "admin" && role !== "instructor")) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-6">Users</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">You do not have access to user management.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Users</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "user" : "users"}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="instructor">Instructor</option>
            <option value="student">Student</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
            <p className="text-destructive">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p>No users found matching your filters.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-muted text-muted-foreground">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Verified</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const RoleIcon = roleIcons[u.role] || Shield
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                            {u.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.full_name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <RoleIcon className="h-4 w-4" />
                          <span className={`px-2 py-1 rounded text-xs font-medium ${roleColors[u.role] || roleColors.student}`}>
                            {roleLabels[u.role] || u.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.is_active ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="text-sm">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Inactive</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          u.is_verified
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {u.is_verified ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isSelf && (
                            <>
                              <label className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={u.is_active}
                                  disabled={updating === u.id}
                                  onChange={(e) => updateUser(u.id, { is_active: e.target.checked })}
                                  className="sr-only"
                                />
                                <span
                                  className={`absolute inset-0 rounded-full ${
                                    u.is_active ? "bg-primary" : "bg-muted"
                                  } ${updating === u.id ? "opacity-50" : ""}`}
                                />
                                <span
                                  className={`absolute top-[3px] h-4 w-4 rounded-full bg-background shadow transition-transform ${
                                    u.is_active ? "left-[20px]" : "left-[3px]"
                                  }`}
                                />
                              </label>
                              <select
                                value={u.role}
                                disabled={updating === u.id || currentUser?.role !== "admin"}
                                onChange={(e) => updateUser(u.id, { role: e.target.value })}
                                className="px-2 py-1 text-xs border border-border rounded bg-background"
                                style={{ width: "90px" }}
                              >
                                <option value="student">Student</option>
                                <option value="instructor">Instructor</option>
                                <option value="admin">Admin</option>
                              </select>
                              {updating === u.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              )}
                            </>
                          )}
                          {isSelf && (
                            <span className="text-xs text-muted-foreground">You</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
