"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"

// Mirrors the app shell (sidebar + header + content) so the real layout
// slots into place without a jump once the session check resolves.
function LoadingScreen() {
  return (
    <div className="flex h-svh" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 flex-col gap-3 border-r p-4 md:flex">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mt-4 h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="ml-auto size-6 rounded-full" />
        </div>
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <Skeleton className="h-7 w-56" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
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
