'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Loader2, LockKeyhole, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.login(data)
      if (response.error) {
        setError(response.error)
        return
      }
      if (response.data) {
        login(response.data.user, response.data.access_token)
        router.push("/dashboard")
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10 sm:px-6 sm:py-16">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 lg:grid-cols-2">
        <aside className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border border-primary-foreground/20" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full border border-primary-foreground/10" />

          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Learn.</span>
          </div>

          <div className="relative max-w-sm">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-1.5 text-xs font-medium">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Your learning space
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Make room for what you want to learn.
            </h1>
            <p className="mt-5 max-w-xs text-base leading-7 text-primary-foreground/85">
              Sign in to pick up where you left off and explore what comes next.
            </p>
          </div>

          <p className="relative text-sm text-primary-foreground/80">A little progress, every day.</p>
        </aside>

        <section aria-labelledby="login-heading" className="flex items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your account</p>
            <h2 id="login-heading" className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to continue your learning journey.</p>

            {error && (
              <div role="alert" className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-destructive"
                    {...register("email")}
                  />
                </div>
                {errors.email && <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-destructive"
                    {...register("password")}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 rounded border-input accent-primary" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">Forgot password?</Link>
              </div>

              <Button type="submit" disabled={isLoading} className="h-12 w-full gap-2 rounded-lg text-sm font-semibold">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in...</> : <>Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
              </Button>
            </form>

            <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
              New to Learn?{" "}
              <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
