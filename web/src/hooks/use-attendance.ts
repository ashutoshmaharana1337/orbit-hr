import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  clockIn,
  clockOut,
  getAttendanceSummary,
  listTodayAttendance,
} from "@/lib/api/attendance"

const attendanceKeys = {
  today: ["attendance", "today"] as const,
  summary: ["attendance", "summary"] as const,
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: attendanceKeys.today,
    queryFn: listTodayAttendance,
  })
}

export function useAttendanceSummary() {
  return useQuery({
    queryKey: attendanceKeys.summary,
    queryFn: getAttendanceSummary,
  })
}

function useInvalidateAttendance() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: attendanceKeys.today })
    queryClient.invalidateQueries({ queryKey: attendanceKeys.summary })
  }
}

export function useClockIn() {
  const invalidate = useInvalidateAttendance()
  return useMutation({
    mutationFn: clockIn,
    onSuccess: invalidate,
  })
}

export function useClockOut() {
  const invalidate = useInvalidateAttendance()
  return useMutation({
    mutationFn: clockOut,
    onSuccess: invalidate,
  })
}
