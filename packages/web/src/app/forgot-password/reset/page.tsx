'use client'

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [done, setDone] = useState(false)

  // The emailed link carries the token; "reset_token" is accepted as well so
  // either name works.
  const token = searchParams.get("token") ?? searchParams.get("reset_token") ?? ""

  if (done) {
    return (
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
    )
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Choose a new password</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {token
          ? "Your reset token has been filled in. Pick a new password to finish."
          : "This page needs the reset token from your email. Paste it below to continue."}
      </p>
      <ResetPasswordForm initialToken={token} onDone={() => setDone(true)} />
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl shadow-foreground/5 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Learn.</span>
        </div>

        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ResetPasswordContent />
        </Suspense>

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
