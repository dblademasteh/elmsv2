'use client'

import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Users, Loader2 } from "lucide-react"
import { enrollmentApi } from "@/lib/api"

type EnrollmentRow = {
  id: string
  user_full_name: string
  user_email: string
  course_title: string
  enrolled_at: string
  progress_percent: number
  status: string
}

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export default function DashboardEnrollmentsPage() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<EnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await enrollmentApi.list({ limit: 100 })
      if (response.data) {
        setRows(response.data)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (user.role !== "admin" && user.role !== "instructor") return
    load()
  }, [user, load])

  if (user?.role !== "admin" && user?.role !== "instructor") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-semibold">Enrollments</h1>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
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
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Enrollments</h1>
          </div>
          {!loading && !loadError && (
            <p className="text-sm text-muted-foreground">
              {rows.length} enrollment{rows.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="font-medium">Enrollments aren't available right now.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
          </div>
         ) : rows.length === 0 ? (
           <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
             <Users className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
             <p className="mt-4 font-medium">No enrollments yet</p>
             <p className="mt-1 text-sm text-muted-foreground">
               Students who enroll in courses will appear here.
             </p>
           </div>
         ) : (
           <>
             {/* Desktop table */}
             <div className="hidden md:block rounded-xl border border-border bg-card overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="border-b bg-muted/60 text-muted-foreground">
                     <th className="px-4 py-3 font-medium">Student</th>
                     <th className="px-4 py-3 font-medium">Course</th>
                     <th className="px-4 py-3 font-medium">Enrolled</th>
                     <th className="px-4 py-3 font-medium">Progress</th>
                     <th className="px-4 py-3 font-medium">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {rows.map((r) => (
                     <tr key={r.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                       <td className="px-4 py-3">
                         <div className="font-medium text-foreground">{r.user_full_name}</div>
                         <div className="text-xs text-muted-foreground">{r.user_email}</div>
                       </td>
                       <td className="px-4 py-3 font-medium">{r.course_title}</td>
                       <td className="px-4 py-3 text-muted-foreground">
                         {new Date(r.enrolled_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                       </td>
                       <td className="px-4 py-3">
                         <div className="flex items-center gap-2">
                           <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                             <div
                               className="h-full rounded-full bg-primary transition-all"
                               style={{ width: `${Math.min(100, r.progress_percent)}%` }}
                             />
                           </div>
                           <span className="text-xs font-medium text-muted-foreground">
                             {Math.round(r.progress_percent)}%
                           </span>
                         </div>
                       </td>
                       <td className="px-4 py-3">
                         <span
                           className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                             STATUS_TONES[r.status] ?? "bg-muted text-muted-foreground"
                           }`}
                         >
                           {r.status}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             {/* Mobile cards */}
             <div className="md:hidden space-y-3">
               {rows.map((r) => (
                 <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                   <div className="flex items-start justify-between gap-2">
                     <div className="min-w-0">
                       <p className="font-medium text-foreground truncate">{r.user_full_name}</p>
                       <p className="text-xs text-muted-foreground truncate">{r.user_email}</p>
                     </div>
                     <span
                       className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                         STATUS_TONES[r.status] ?? "bg-muted text-muted-foreground"
                       }`}
                     >
                       {r.status}
                     </span>
                   </div>
                   <p className="text-sm font-medium">{r.course_title}</p>
                   <div className="flex items-center gap-2">
                     <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                       <div
                         className="h-full rounded-full bg-primary transition-all"
                         style={{ width: `${Math.min(100, r.progress_percent)}%` }}
                       />
                     </div>
                     <span className="text-xs font-medium text-muted-foreground">
                       {Math.round(r.progress_percent)}%
                     </span>
                   </div>
                   <p className="text-xs text-muted-foreground">
                     Enrolled {new Date(r.enrolled_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                   </p>
                 </div>
               ))}
             </div>
           </>
         )}
      </div>
    </DashboardLayout>
  )
}
