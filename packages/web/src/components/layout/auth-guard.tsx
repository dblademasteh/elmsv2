import { useAuthStore } from "@/store/auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) return null
  return <>{children}</>
}

export { AuthGuard }
