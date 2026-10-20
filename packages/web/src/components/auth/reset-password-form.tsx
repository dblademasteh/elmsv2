"use client"

import { useState } from "react"
import { ArrowRight, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api"

interface ResetPasswordFormProps {
  /** The token from the reset link, pre-filled when there is one. */
  initialToken?: string
  /** Called after the password has been changed. */
  onDone?: () => void
}

/**
 * The "choose a new password" form.
 *
 * Shared by `/forgot-password` (the token is pasted by hand) and
 * `/forgot-password/reset` (the token arrives in the link).
 */
export function ResetPasswordForm({ initialToken = "", onDone }: ResetPasswordFormProps) {
  const [resetToken, setResetToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resetToken.trim()) {
      setError("Please enter the reset token from your email.")
      return
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const response = await authApi.resetPassword(resetToken.trim(), newPassword)
      if (response.error) {
        setError(response.error)
        return
      }
      onDone?.()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <form className="mt-6 space-y-5" onSubmit={handleReset} noValidate>
        <div className="space-y-2">
          <Label htmlFor="token" className="text-sm font-medium">Reset token</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="token"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste the token from your email"
              className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-sm font-medium">New password</Label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</Label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
            placeholder="Repeat the new password"
          />
        </div>
        <Button type="submit" disabled={isLoading} className="h-12 w-full gap-2 rounded-lg text-sm font-semibold">
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Updating...</>
          ) : (
            <>Update password <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
          )}
        </Button>
      </form>
    </>
  )
}
