import { apiFetch } from "@/lib/api-client"
import type { Department, DepartmentDetail, CursorPaginatedResponse } from "./types"

export type CreateDepartmentInput = {
  name: string
  description?: string
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>

export function listDepartments() {
  return apiFetch<CursorPaginatedResponse<Department>>("/departments?limit=100")
}

export function getDepartment(id: string) {
  return apiFetch<DepartmentDetail>(`/departments/${id}`)
}

export function createDepartment(input: CreateDepartmentInput) {
  return apiFetch<Department>("/departments", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateDepartment(id: string, input: UpdateDepartmentInput) {
  return apiFetch<Department>(`/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteDepartment(id: string) {
  return apiFetch<void>(`/departments/${id}`, { method: "DELETE" })
}
