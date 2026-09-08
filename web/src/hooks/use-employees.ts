import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "@/lib/api/employees"
import type {
  CreateEmployeeInput,
  ListEmployeesParams,
  UpdateEmployeeInput,
} from "@/lib/api/types"

const employeeKeys = {
  list: (params?: ListEmployeesParams) => ["employees", "list", params ?? {}] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
}

export function useEmployees(params?: ListEmployeesParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => listEmployees(params),
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => getEmployee(id),
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", "list"] })
    },
  })
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => updateEmployee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", "list"] })
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) })
    },
  })
}
