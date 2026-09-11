import { apiFetch } from "@/lib/api-client"
import type {
  CreateEmployeeInput,
  CursorPaginatedResponse,
  EmployeeDetail,
  EmployeeSummary,
  ListEmployeesParams,
  UpdateEmployeeInput,
} from "./types"

function toQueryString(params?: ListEmployeesParams) {
  if (!params) return ""
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== null && entry[1] !== ""
  )
  if (!entries.length) return ""
  return `?${new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString()}`
}

export function listEmployees(params?: ListEmployeesParams) {
  return apiFetch<CursorPaginatedResponse<EmployeeSummary>>(`/employees${toQueryString(params)}`)
}

export function getEmployee(id: string) {
  return apiFetch<EmployeeDetail>(`/employees/${id}`)
}

export function createEmployee(input: CreateEmployeeInput) {
  return apiFetch<EmployeeDetail>("/employees", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateEmployee(id: string, input: UpdateEmployeeInput) {
  return apiFetch<EmployeeDetail>(`/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}
