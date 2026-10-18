'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, KeyRound, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<"request" | "reset" | "done">("request")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [devToken, setDevToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const response = await authApi.requestPasswordReset(email.trim())
      if (response.error) {
        setError(response.error)
        return
      }
      setInfo(response.data?.message ?? "If an account with that email exists, a reset link has been sent.")
      if (response.data?.reset_token) {
        setDevToken(response.data.reset_token)
        setResetToken(response.data.reset_token)
      }
      setStep("reset")
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      setStep("done")
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl shadow-foreground/5 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Learn.</span>
        </div>

        {step === "request" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forgot your password?</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Enter the email you signed up with and we'll send you a reset link.
            </p>
            {error && (
              <div role="alert" className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form className="mt-8 space-y-5" onSubmit={handleRequest} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="h-12 w-full gap-2 rounded-lg text-sm font-semibold">
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending...</>
                ) : (
                  <>Send reset link <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
                )}
              </Button>
            </form>
          </>
        )}

        {step === "reset" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
            {info && (
              <div role="status" className="mt-4 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
                {info}
              </div>
            )}
            {devToken && (
              <p className="mt-3 rounded-lg border border-amber-300/40 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                Dev mode: email delivery isn't configured, so the reset token is prefilled below.
              </p>
            )}
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
                  <>Update password</>
                )}
              </Button>
            </form>
          </>
        )}

        {step === "done" && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Password updated</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your password has been changed. You can now sign in with the new password.
            </p>
            <Button className="mt-8 h-12 w-full rounded-lg text-sm font-semibold" onClick={() => router.push("/login")}>
              Back to sign in
            </Button>
          </div>
        )}

        <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>

        <div aria-hidden="true" className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
          <BookOpen className="h-3 w-3" />
          Keep your password safe
        </div>
      </div>
    </div>
  )
}
