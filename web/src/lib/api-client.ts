const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

// The session lives in httpOnly cookies the browser attaches automatically —
// these endpoints' own 401s mean "not authenticated" or "refresh failed",
// never "access token expired", so retrying them would just loop.
const NO_REFRESH_RETRY_PATHS = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"])

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
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
    }
  }

  if (!res.ok) {
    let message = res.statusText || "Request failed"
    try {
      const body = await res.json()
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message
      }
    } catch {
      // response had no JSON body — fall back to statusText
    }
    throw new ApiError(res.status, message)
  }

  // Some endpoints (e.g. 204) may have no body.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
