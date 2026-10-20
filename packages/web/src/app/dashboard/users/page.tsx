'use client'

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { userApi } from "@/lib/api"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
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

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
      {name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"}
    </div>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  })
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
  // A set, not a single id: two rows can be updated at the same time and a
  // single id would let the first response clear the second row's spinner.
  const [updating, setUpdating] = useState<Set<string>>(new Set())

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
    setUpdating((prev) => new Set(prev).add(userId))
    setError(null)
    const resp = await userApi.update(userId, data)
    if (resp.data) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...resp.data } as User : u)))
    } else {
      setError(resp.error || "Failed to update user")
    }
    setUpdating((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || u.role === roleFilter
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.is_active : !u.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  if (!currentUser || role !== "admin") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">Users</h1>
          </div>
          <Card className="border-border p-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-muted-foreground">You do not have access to user management.</p>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">Users</h1>
            <span className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "user" : "users"}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Filters */}
        <Card className="mb-4 border-border">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                aria-label="Search users"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="instructor">Instructor</option>
                <option value="student">Student</option>
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </Card>

        {/* Loading */}
        {loading ? (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="h-4 flex-1 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-border p-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-muted-foreground">No users found matching your filters.</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="w-48 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="w-56 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="w-28 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="w-24 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="w-24 truncate px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verified</th>
                  <th className="w-32 truncate px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                  <th className="w-44 truncate px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => {
                  const RoleIcon = roleIcons[u.role] || Shield
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-muted/30">
                      <td className="truncate px-6 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.full_name} />
                          <span className="font-medium text-foreground">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="truncate px-6 py-4 text-muted-foreground">{u.email}</td>
                      <td className="truncate px-6 py-4">
                        <div className="flex items-center gap-2">
                          <RoleIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className={`rounded px-2 py-1 text-xs font-medium ${roleColors[u.role] || roleColors.student}`}>
                            {roleLabels[u.role] || u.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {u.is_active ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                              <span className="text-sm">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              <span className="text-sm text-muted-foreground">Inactive</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            u.is_verified
                              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.is_verified ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td className="truncate px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">You</span>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <label className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors">
                              <input
                                type="checkbox"
                                checked={u.is_active}
                                disabled={updating.has(u.id)}
                                onChange={(e) => updateUser(u.id, { is_active: e.target.checked })}
                                className="sr-only"
                                aria-label={`Toggle active for ${u.full_name}`}
                              />
                              <span
                                className={`absolute inset-0 rounded-full ${u.is_active ? "bg-primary" : "bg-muted"} ${
                                  updating.has(u.id) ? "opacity-50" : ""
                                }`}
                              />
                              <span
                                className={`absolute top-[3px] h-4 w-4 rounded-full bg-background shadow transition-transform ${
                                  u.is_active ? "left-[20px]" : "left-[3px]"
                                }`}
                              />
                            </label>
                            <select
                              value={u.role}
                              disabled={updating.has(u.id) || currentUser?.role !== "admin"}
                              onChange={(e) => updateUser(u.id, { role: e.target.value })}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                              aria-label={`Change role for ${u.full_name}`}
                            >
                              <option value="student">Student</option>
                              <option value="instructor">Instructor</option>
                              <option value="admin">Admin</option>
                            </select>
                            {updating.has(u.id) && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                            )}
                          </div>
                        )}
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
