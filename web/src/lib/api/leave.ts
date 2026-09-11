import { apiFetch } from "@/lib/api-client"
import type {
  CreateLeaveRequestInput,
  CursorPaginatedResponse,
  LeaveBalance,
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
  return apiFetch<LeaveBalance>(`/leave/balance/${employeeId}`)
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
