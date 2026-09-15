"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import { apiFetch, SESSION_EXPIRED_EVENT } from "@/lib/api-client"
import type { EmployeeStatus, Role } from "@/lib/api/types"

export type { EmployeeStatus, Role }

export type AuthEmployee = {
  id: string
  name: string
  title: string
  departmentId: string | null
  location: string
  status: EmployeeStatus
  phone: string
  joinDate: string
  managerId: string | null
}

export type AuthUser = {
  id: string
  email: string
  role: Role
  // `timezone` is the tenant IANA zone from /auth/me; optional so older API
  // builds without it still type-check and the formatters fall back to browser TZ.
  tenant: { id: string; name: string; slug: string; timezone?: string }
  employee: AuthEmployee | null
}

type AuthState = {
  user: AuthUser | null
  employee: AuthEmployee | null
  loading: boolean
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthEmployee | null>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    employee: null,
    loading: true,
  })
  const router = useRouter()
  const queryClient = useQueryClient()

  // Mirror of `state.user` so the expiry listener below can check it without
  // re-subscribing on every auth change.
  const hasUserRef = React.useRef(false)
  React.useEffect(() => {
    hasUserRef.current = state.user !== null
  }, [state.user])

  // The session lives in an httpOnly cookie, invisible to this code — the
  // only way to know whether one exists is to ask the server.
  React.useEffect(() => {
    apiFetch<AuthUser>("/auth/me")
      .then((me) => setState({ user: me, employee: me.employee, loading: false }))
      .catch(() => setState({ user: null, employee: null, loading: false }))
  }, [])

  // A 401 that refresh couldn't recover: drop the user, throw away cached
  // data from the old session, and send them to sign in again. Only acts
  // when someone was actually signed in — an anonymous visitor's initial
  // /auth/me probe also 401s, and that isn't an "expired" session.
  React.useEffect(() => {
    function onSessionExpired() {
      if (!hasUserRef.current) return
      setState({ user: null, employee: null, loading: false })
      queryClient.clear()
      router.replace("/login?expired=1")
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [queryClient, router])

  const login = React.useCallback(async (email: string, password: string) => {
    const me = await apiFetch<AuthUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    setState({ user: me, employee: me.employee, loading: false })
    return me.employee
  }, [])

  const logout = React.useCallback(() => {
    apiFetch("/auth/logout", { method: "POST" })
      .catch(() => {
        // Best-effort revoke — clear local state and redirect regardless.
      })
      .finally(() => {
        setState({ user: null, employee: null, loading: false })
        window.location.href = "/login"
      })
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
