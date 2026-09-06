"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"

function LoadingScreen() {
  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  if (loading || !user) {
    return <LoadingScreen />
  }

  return <>{children}</>
}
