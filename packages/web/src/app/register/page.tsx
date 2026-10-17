'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await authApi.register(data)
      if (response.error) {
        setError(response.error)
        return
      }

      if (response.data) {
        try {
          const loginResponse = await authApi.login({ email: data.email, password: data.password })
          if (loginResponse.data) {
            login(loginResponse.data.user, loginResponse.data.access_token)
            router.push("/")
          } else {
            router.push("/login")
          }
        } catch {
          router.push("/login")
        }
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5 lg:grid-cols-2">
        <aside className="relative hidden min-h-[680px] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-12">
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
              Start with a little curiosity.
            </h1>
            <p className="mt-5 max-w-xs text-base leading-7 text-primary-foreground/85">
              Create your account and make space for the things you want to learn.
            </p>
          </div>

          <p className="relative text-sm text-primary-foreground/80">A little progress, every day.</p>
        </aside>

        <section aria-labelledby="register-heading" className="flex items-center px-6 py-9 sm:px-12 sm:py-12 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Get started</p>
            <h2 id="register-heading" className="text-3xl font-semibold tracking-tight text-foreground">Create your account</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">A few details are all you need to begin.</p>

            {error && (
              <div role="alert" className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-sm font-medium">Full name</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="full_name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    aria-invalid={!!errors.full_name}
                    aria-describedby={errors.full_name ? "full-name-error" : undefined}
                    className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-destructive"
                    {...register("full_name")}
                  />
                </div>
                {errors.full_name && <p id="full-name-error" className="text-sm text-destructive">{errors.full_name.message}</p>}
              </div>

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
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : "password-hint"}
                    className="h-12 w-full rounded-lg border border-input bg-background pl-11 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/20 aria-[invalid=true]:border-destructive"
                    {...register("password")}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password ? <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p> : <p id="password-hint" className="text-xs text-muted-foreground">Use 8 characters or more.</p>}
              </div>

              <Button type="submit" disabled={isLoading} className="h-12 w-full gap-2 rounded-lg text-sm font-semibold">
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Creating account...</> : <>Create account <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
              </Button>
            </form>

            <p className="mt-7 border-t border-border pt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
