'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save, UserIcon, UserRound, LockKeyhole, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { authApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

export default function ProfilePage() {
  const router = useRouter()
  const { user, setUser, token } = useAuthStore()
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile")
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || "")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "")

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!user || !token) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto p-6">
          <p className="text-muted-foreground">Loading profile…</p>
        </div>
      </DashboardLayout>
    )
  }

  const handleProfileSave = async () => {
    setSaveError(null)
    setSaveSuccess(null)

    if (!fullName.trim()) {
      setSaveError("Full name is required")
      return
    }

    setIsSaving(true)
    try {
      const response = await authApi.updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      })
      if (response.error) {
        setSaveError(response.error)
      } else if (response.data) {
        setUser(response.data)
        setSaveSuccess("Profile updated successfully")
      }
    } catch {
      setSaveError("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSave = async () => {
    setSaveError(null)
    setSaveSuccess(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSaveError("All password fields are required")
      return
    }
    if (newPassword !== confirmPassword) {
      setSaveError("New passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      setSaveError("New password must be at least 8 characters")
      return
    }

    setIsSavingPassword(true)
    try {
      const response = await authApi.updateProfile({
        password: newPassword,
        current_password: currentPassword,
      })
      if (response.error) {
        setSaveError(response.error)
      } else {
        setSaveSuccess("Password changed successfully")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch {
      setSaveError("Failed to change password")
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
          </div>
        </div>

        {/* User avatar + basic info bar */}
        <Card className="mb-6 flex items-center gap-4 border-border p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-xl font-medium text-foreground">
            {user.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() ?? "U"}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-foreground">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            {user.role}
          </span>
        </Card>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted/40 p-1.5">
          <button
            type="button"
            onClick={() => { setActiveTab("profile"); setSaveError(null); setSaveSuccess(null) }}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === "profile"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-selected={activeTab === "profile"}
          >
            <UserIcon className="h-4 w-4" aria-hidden="true" />
            Profile
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("password"); setSaveError(null); setSaveSuccess(null) }}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === "password"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-selected={activeTab === "password"}
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Password
          </button>
        </div>

        {/* Success / Error messages */}
        {saveSuccess && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-400"
          >
            {saveSuccess}
          </div>
        )}
        {saveError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {saveError}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <Card className="border-border p-6">
            <div className="space-y-5">
            <div>
              <Label htmlFor="full-name" className="text-sm font-medium">
                Full name
              </Label>
              <div className="relative mt-1.5">
                <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  maxLength={255}
                  autoComplete="name"
                  className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="avatar-url" className="text-sm font-medium">
                Avatar URL
              </Label>
              <div className="relative mt-1.5">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="avatar-url"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter a URL to an image that will be used as your profile picture.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleProfileSave}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
          </div>
        </Card>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <Card className="border-border p-6">
            <div className="space-y-5">
            <div>
              <Label htmlFor="current-password" className="text-sm font-medium">
                Current password
              </Label>
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="h-12 w-full rounded-lg border border-input bg-background pr-12 pl-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  aria-pressed={showCurrent}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="new-password" className="text-sm font-medium">
                New password
              </Label>
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter a new password (min 8 characters)"
                  className="h-12 w-full rounded-lg border border-input bg-background pr-12 pl-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  aria-pressed={showNew}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm new password
              </Label>
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="h-12 w-full rounded-lg border border-input bg-background pr-12 pl-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  aria-pressed={showConfirm}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentPassword("")
                  setNewPassword("")
                  setConfirmPassword("")
                  setSaveError(null)
                  setSaveSuccess(null)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePasswordSave}
                disabled={isSavingPassword}
                className="gap-2"
              >
                {isSavingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
              {isSavingPassword ? "Changing…" : "Save password"}
            </Button>
          </div>
          </div>
        </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
