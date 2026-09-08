"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ApiError } from "@/lib/api-client"

function shouldRetry(failureCount: number, error: unknown) {
  // 4xx means the request itself was wrong (bad auth, not found, validation) —
  // retrying won't help. Only retry on network errors / 5xx, and only twice.
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 2
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: shouldRetry,
            staleTime: 30_000,
          },
          mutations: {
            retry: false,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
