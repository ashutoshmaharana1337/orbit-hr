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
  all: ["leave"] as const,
  list: (params?: ListLeaveParams) => ["leave", "list", params ?? {}] as const,
  balance: (employeeId: string) => ["leave", "balance", employeeId] as const,
}

/**
 * Fetch leave requests with cursor pagination support.
 * First call with undefined cursor, then use nextCursor from response for subsequent calls.
 */
export function useLeaveRequests(params?: ListLeaveParams) {
  return useQuery({
    queryKey: leaveKeys.list(params),
    queryFn: async () => {
      const response = await listLeaveRequests(params)
      return response
    },
  })
}

/**
 * Get the leave balance for a specific employee.
 */
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
    queryClient.invalidateQueries({ queryKey: leaveKeys.all })
    // Approve/reject/create all move onLeaveToday and pendingLeaveRequests
    // on the dashboard — cheap to refetch, confusing to leave stale.
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] })
  }
}

/**
 * Mutation to create a new leave request.
 */
export function useCreateLeaveRequest() {
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => createLeaveRequest(input),
    onSuccess: invalidate,
  })
}

/**
 * Mutation to approve a leave request (HR/Manager only).
 */
export function useApproveLeave() {
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: invalidate,
  })
}

/**
 * Mutation to reject a leave request (HR/Manager only).
 */
export function useRejectLeave() {
  const invalidate = useInvalidateLeave()
  return useMutation({
    mutationFn: (id: string) => rejectLeaveRequest(id),
    onSuccess: invalidate,
  })
}
