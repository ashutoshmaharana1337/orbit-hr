const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, headers, ...rest } = options ?? {}

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

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
