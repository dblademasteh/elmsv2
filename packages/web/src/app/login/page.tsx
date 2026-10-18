'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Loader2, LockKeyhole, Mail, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormData = z.infer<typeof loginSchema>

const demoUsers = [
  { role: "Admin", email: "admin@lms.com", password: "Admin123!@#" },
  { role: "Instructor", email: "instructor@lms.com", password: "Instructor123!@#" },
  { role: "Student", email: "student@lms.com", password: "Student123!@#" },
]

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard")
    }
  }, [isAuthenticated, router])

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
        login(response.data.user, response.data.access_token, response.data.refresh_token)
        router.push("/dashboard")
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const fillDemo = (email: string, password: string) => {
    setValue("email", email, { shouldValidate: true })
    setValue("password", password, { shouldValidate: true })
    setError(null)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-muted/60 via-background to-background px-4 py-10 sm:px-6 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-border/60 bg-card/80 shadow-2xl shadow-foreground/[0.04] backdrop-blur-xl lg:grid-cols-2"
      >
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative hidden min-h-[640px] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90 p-10 text-primary-foreground lg:flex xl:p-12"
        >
          <motion.div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border border-primary-foreground/20" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1 }} />
          <motion.div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full border border-primary-foreground/10" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1, delay: 0.1 }} />

          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-foreground/15 ring-1 ring-inset ring-primary-foreground/20 backdrop-blur">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Learn.</span>
          </div>

          <div className="relative max-w-sm">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3.5 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Your learning space
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight xl:text-[3rem]">
              Make room for what you want to learn.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-5 max-w-xs text-base leading-7 text-primary-foreground/85">
              Sign in to pick up where you left off and explore what comes next.
            </motion.p>
          </div>

          <p className="relative text-sm text-primary-foreground/80">A little progress, every day.</p>
        </motion.aside>

        <section aria-labelledby="login-heading" className="relative flex items-center px-6 py-10 sm:px-12 sm:py-14 lg:px-10 xl:px-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 lg:hidden">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Your account</p>
            <h2 id="login-heading" className="text-[28px] font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to continue your learning journey.</p>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  role="alert"
                  aria-live="polite"
                  className="mt-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative group">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" aria-hidden="true" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="name@example.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="h-12 w-full rounded-xl border border-input bg-background/70 pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive"
                    {...register("email")}
                  />
                </div>
                {errors.email && <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot?</Link>
                </div>
                <div className="relative group">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className="h-12 w-full rounded-xl border border-input bg-background/70 pl-11 pr-12 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive"
                    {...register("password")}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2.5 text-muted-foreground select-none">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded-md border-input bg-background text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  Remember me
                </label>
              </div>

              <Button type="submit" disabled={isLoading || isSubmitting} className="h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.99]">
                {isLoading || isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </Button>

              <div className="pt-2">
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick access</p>
                <div className="grid grid-cols-1 gap-2">
                  {demoUsers.map((u) => (
                    <button
                      key={u.role}
                      type="button"
                      onClick={() => fillDemo(u.email, u.password)}
                      className="group flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-muted/70 hover:border-border"
                    >
                      <span className="font-medium text-foreground">{u.role}</span>
                      <span className="truncate text-muted-foreground">{u.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>

            <p className="mt-8 border-t border-border/70 pt-6 text-center text-sm text-muted-foreground">
              New to Learn?{" "}
              <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
            </p>
          </motion.div>
        </section>
      </motion.div>
    </div>
  )
}
