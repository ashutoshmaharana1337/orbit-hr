import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from "@/lib/api/departments"

const departmentKeys = {
  all: ["departments"] as const,
  list: () => ["departments", "list"] as const,
  detail: (id: string) => ["departments", "detail", id] as const,
}

export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.list(),
    queryFn: listDepartments,
  })
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: departmentKeys.detail(id),
    queryFn: () => getDepartment(id),
    enabled: !!id,
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.list() })
    },
  })
}

export function useUpdateDepartment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateDepartmentInput) => updateDepartment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.list() })
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(id) })
    },
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.list() })
    },
  })
}
