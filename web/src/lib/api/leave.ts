import { apiFetch } from "@/lib/api-client"
import type {
  CreateLeaveRequestInput,
  LeaveBalance,
  LeaveRequestListEntry,
  LeaveRequestRecord,
  ListLeaveParams,
} from "./types"

function toQueryString(params?: ListLeaveParams) {
  if (!params) return ""
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => !!entry[1]
  )
  if (!entries.length) return ""
  return `?${new URLSearchParams(entries).toString()}`
}

export function listLeaveRequests(params?: ListLeaveParams) {
  return apiFetch<LeaveRequestListEntry[]>(`/leave${toQueryString(params)}`)
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
