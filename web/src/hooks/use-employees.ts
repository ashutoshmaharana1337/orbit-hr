import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "@/lib/api/employees"
import type {
  CreateEmployeeInput,
  EmployeeSummary,
  ListEmployeesParams,
  UpdateEmployeeInput,
} from "@/lib/api/types"

const employeeKeys = {
  all: ["employees"] as const,
  list: (params?: ListEmployeesParams) => ["employees", "list", params ?? {}] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
}

/**
 * Fetch employees, following the API's cursor pagination. `data.items` is
 * every page loaded so far flattened together; call `fetchNextPage()` while
 * `hasNextPage` to load more. Callers that only need the first page can keep
 * reading `data.items` as before.
 */
export function useEmployees(params?: Omit<ListEmployeesParams, "cursor">) {
  return useInfiniteQuery({
    queryKey: employeeKeys.list(params),
    queryFn: ({ pageParam }) => listEmployees({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items) as EmployeeSummary[],
      hasMore: data.pages.at(-1)?.hasMore ?? false,
    }),
  })
}

/**
 * Get a single employee by ID.
 */
export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => getEmployee(id),
    enabled: !!id,
  })
}

/**
 * Mutation to create a new employee. For getting the list of employees to show
 * in a manager dropdown, you may want to pass search/filter params, but note
 * that the result is cursor-paginated and the hook doesn't automatically
 * load all pages.
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all })
    },
  })
}

/**
 * Mutation to update an employee.
 */
export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => updateEmployee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all })
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) })
    },
  })
}
