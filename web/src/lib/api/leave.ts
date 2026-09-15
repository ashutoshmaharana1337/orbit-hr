import { apiFetch } from "@/lib/api-client"
import type {
  CreateLeaveRequestInput,
  CursorPaginatedResponse,
  LeaveBalance,
  LeaveBalanceResponse,
  LeaveRequestListEntry,
  LeaveRequestRecord,
  ListLeaveParams,
} from "./types"

function toQueryString(params?: ListLeaveParams) {
  if (!params) return ""
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== null && entry[1] !== ""
  )
  if (!entries.length) return ""
  return `?${new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString()}`
}

export function listLeaveRequests(params?: ListLeaveParams) {
  return apiFetch<CursorPaginatedResponse<LeaveRequestListEntry>>(`/leave${toQueryString(params)}`)
}

export function getLeaveBalance(employeeId: string) {
  return apiFetch<LeaveBalanceResponse>(`/leave/balance/${employeeId}`)
}

/**
 * The balance endpoint is moving from a single `{ annualUsed, annualTotal,
 * sickUsed, sickTotal }` object to one entry per leave policy. Accept both
 * and always hand callers the per-policy array. Numbers come from Prisma
 * Decimal columns and may be serialised as strings, so coerce them.
 */
export function normalizeLeaveBalances(data: LeaveBalanceResponse | null | undefined): LeaveBalance[] {
  if (!data) return []
  if (Array.isArray(data)) {
    return data.map((b) => ({
      policy: { id: String(b.policy?.id ?? ""), name: String(b.policy?.name ?? "Leave") },
      year: Number(b.year),
      entitledDays: Number(b.entitledDays) || 0,
      usedDays: Number(b.usedDays) || 0,
      balanceDays: Number(b.balanceDays) || 0,
    }))
  }
  const year = new Date().getFullYear()
  const annualTotal = Number(data.annualTotal) || 0
  const annualUsed = Number(data.annualUsed) || 0
  const sickTotal = Number(data.sickTotal) || 0
  const sickUsed = Number(data.sickUsed) || 0
  return [
    { policy: { id: "annual", name: "Annual leave" }, year, entitledDays: annualTotal, usedDays: annualUsed, balanceDays: annualTotal - annualUsed },
    { policy: { id: "sick", name: "Sick leave" }, year, entitledDays: sickTotal, usedDays: sickUsed, balanceDays: sickTotal - sickUsed },
  ]
}

export function createLeaveRequest(input: CreateLeaveRequestInput) {
  return apiFetch<LeaveRequestRecord>("/leave", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function approveLeaveRequest(id: string) {
  return apiFetch<LeaveRequestRecord>(`/leave/${id}/approve`, { method: "PATCH" })
}

export function rejectLeaveRequest(id: string) {
  return apiFetch<LeaveRequestRecord>(`/leave/${id}/reject`, { method: "PATCH" })
}
