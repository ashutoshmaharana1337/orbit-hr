import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  approveLeaveRequest,
  createLeaveRequest,
  getLeaveBalance,
  listLeaveRequests,
  rejectLeaveRequest,
} from "@/lib/api/leave"
import type { CreateLeaveRequestInput, ListLeaveParams } from "@/lib/api/types"

const leaveKeys = {
  list: (params?: ListLeaveParams) => ["leave", "list", params ?? {}] as const,
  balance: (employeeId: string) => ["leave", "balance", employeeId] as const,
}

export function useLeaveRequests(params?: ListLeaveParams) {
  return useQuery({
    queryKey: leaveKeys.list(params),
    queryFn: () => listLeaveRequests(params),
  })
}

export function useLeaveBalance(employeeId: string) {
  return useQuery({
    queryKey: leaveKeys.balance(employeeId),
    queryFn: () => getLeaveBalance(employeeId),
    enabled: !!employeeId,
  })
}

function useInvalidateLeave() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["leave", "list"] })
    queryClient.invalidateQueries({ queryKey: ["leave", "balance"] })
    // Approve/reject/create all move onLeaveToday and pendingLeaveRequests
    // on the dashboard — cheap to refetch, confusing to leave stale.
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] })
  }
}

export function useCreateLeaveRequest() {
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => createLeaveRequest(input),
    onSuccess: invalidate,
  })
}

export function useApproveLeave() {
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: invalidate,
  })
}

export function useRejectLeave() {
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: (id: string) => rejectLeaveRequest(id),
    onSuccess: invalidate,
  })
}
