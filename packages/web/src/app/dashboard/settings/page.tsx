'use client'

import { useAuthStore } from "@/store/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Settings } from "lucide-react"

export default function DashboardSettingsPage() {
  const { user } = useAuthStore()

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              {user?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U"}
            </div>
            <div className="flex flex-col">
              <p className="font-medium">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <hr className="border-border my-4" />
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer">
              <span className="text-sm">Account</span>
              <span className="text-xs text-muted-foreground">Manage your profile</span>
            </div>
            <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer">
              <span className="text-sm">Notifications</span>
              <span className="text-xs text-muted-foreground">Configure alerts</span>
            </div>
            <div className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer">
              <span className="text-sm">Privacy</span>
              <span className="text-xs text-muted-foreground">Data and security settings</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
