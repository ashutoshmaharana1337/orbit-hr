import { apiFetch } from "@/lib/api-client"
import type { AttendanceRecord, AttendanceSummaryEntry } from "./types"

export function listTodayAttendance() {
  return apiFetch<AttendanceRecord[]>("/attendance/today")
}

export function getAttendanceSummary() {
  return apiFetch<AttendanceSummaryEntry[]>("/attendance/summary")
}

export function clockIn() {
  return apiFetch<AttendanceRecord>("/attendance/clock-in", { method: "POST" })
}

export function clockOut() {
  return apiFetch<AttendanceRecord>("/attendance/clock-out", { method: "PATCH" })
}
