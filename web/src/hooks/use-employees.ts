import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
 * Fetch employees with cursor pagination support.
 * First call with undefined cursor, then use nextCursor from response for subsequent calls.
 */
export function useEmployees(params?: ListEmployeesParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => {
      const response = await listEmployees(params)
      return response
    },
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
