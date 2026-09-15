const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

// The session lives in httpOnly cookies the browser attaches automatically —
// these endpoints' own 401s mean "not authenticated" or "refresh failed",
// never "access token expired", so retrying them would just loop.
const NO_REFRESH_RETRY_PATHS = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"])

// Fired on `window` when a 401 could not be recovered by refreshing.
export const SESSION_EXPIRED_EVENT = "orbit:session-expired"

export class ApiError extends Error {
  status: number
  /** Individual validation messages (class-validator returns `message: string[]` on 400). */
  messages: string[]

  constructor(status: number, message: string, messages?: string[]) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.messages = messages ?? [message]
  }
}

function rawFetch(path: string, options?: RequestInit) {
  const { headers, ...rest } = options ?? {}
  return fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })
}

// Dedupe concurrent refreshes so N requests failing at once don't each spawn
// their own /auth/refresh call.
let refreshInFlight: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = rawFetch("/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  let res = await rawFetch(path, options)

  if (res.status === 401 && !NO_REFRESH_RETRY_PATHS.has(path)) {
    const refreshed = await refreshSession()
    if (refreshed) {
      res = await rawFetch(path, options)
    } else if (typeof window !== "undefined") {
      // The session is gone for good — let AuthProvider clear state and
      // send the user back to the login page instead of leaving every
      // query in an error state with a stale `user`.
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
  }

  if (!res.ok) {
    let message = res.statusText || "Request failed"
    let messages: string[] | undefined
    try {
      const body = await res.json()
      if (body?.message) {
        if (Array.isArray(body.message)) {
          const list: string[] = body.message.map(String)
          messages = list
          message = list.join(", ")
        } else {
          message = String(body.message)
        }
      }
    } catch {
      // response had no JSON body — fall back to statusText
    }
    throw new ApiError(res.status, message, messages)
  }

  // Some endpoints (e.g. 204) may have no body.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
