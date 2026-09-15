import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  approveLeaveRequest,
  createLeaveRequest,
  getLeaveBalance,
  listLeaveRequests,
  normalizeLeaveBalances,
  rejectLeaveRequest,
} from "@/lib/api/leave"
import type { CreateLeaveRequestInput, LeaveRequestListEntry, ListLeaveParams } from "@/lib/api/types"

const leaveKeys = {
  all: ["leave"] as const,
  list: (params?: ListLeaveParams) => ["leave", "list", params ?? {}] as const,
  balance: (employeeId: string) => ["leave", "balance", employeeId] as const,
}

/**
 * Fetch leave requests, following the API's cursor pagination. `data.items`
 * is every page loaded so far flattened together; call `fetchNextPage()`
 * while `hasNextPage` to load more.
 */
export function useLeaveRequests(params?: Omit<ListLeaveParams, "cursor">) {
  return useInfiniteQuery({
    queryKey: leaveKeys.list(params),
    queryFn: ({ pageParam }) => listLeaveRequests({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items) as LeaveRequestListEntry[],
      hasMore: data.pages.at(-1)?.hasMore ?? false,
    }),
  })
}

/**
 * Get the leave balances for a specific employee, one entry per policy.
 * Normalised via `normalizeLeaveBalances` so callers always see the array
 * shape even while the API transitions from the old single-object response.
 */
export function useLeaveBalance(employeeId: string) {
  return useQuery({
    queryKey: leaveKeys.balance(employeeId),
    queryFn: async () => normalizeLeaveBalances(await getLeaveBalance(employeeId)),
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
