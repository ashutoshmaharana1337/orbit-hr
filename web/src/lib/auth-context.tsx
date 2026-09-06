"use client"

import * as React from "react"

import { apiFetch } from "@/lib/api-client"

export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE"

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE"

export type AuthEmployee = {
  id: string
  name: string
  title: string
  department: string
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
  tenant: { id: string; name: string; slug: string }
  employee: AuthEmployee | null
}

type MeResponse = AuthUser

type LoginResponse = { accessToken: string }

type AuthState = {
  token: string | null
  user: AuthUser | null
  employee: AuthEmployee | null
  loading: boolean
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthEmployee | null>
  logout: () => void
}

const TOKEN_KEY = "orbit_token"

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    token: null,
    user: null,
    employee: null,
    loading: true,
  })

  React.useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY)
    if (!storedToken) {
      setState((s) => ({ ...s, loading: false }))
      return
    }

    apiFetch<MeResponse>("/auth/me", { token: storedToken })
      .then((me) => {
        setState({
          token: storedToken,
          user: me,
          employee: me.employee,
          loading: false,
        })
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY)
        setState({ token: null, user: null, employee: null, loading: false })
      })
  }, [])

  const login = React.useCallback(async (email: string, password: string) => {
    const { accessToken } = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    window.localStorage.setItem(TOKEN_KEY, accessToken)

    const me = await apiFetch<MeResponse>("/auth/me", { token: accessToken })

    setState({
      token: accessToken,
      user: me,
      employee: me.employee,
      loading: false,
    })

    return me.employee
  }, [])

  const logout = React.useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setState({ token: null, user: null, employee: null, loading: false })
    window.location.href = "/login"
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
