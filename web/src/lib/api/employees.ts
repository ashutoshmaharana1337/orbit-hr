import { apiFetch } from "@/lib/api-client"
import type {
  CreateEmployeeInput,
  EmployeeDetail,
  EmployeeSummary,
  ListEmployeesParams,
  UpdateEmployeeInput,
} from "./types"

function toQueryString(params?: ListEmployeesParams) {
  if (!params) return ""
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => !!entry[1]
  )
  if (!entries.length) return ""
  return `?${new URLSearchParams(entries).toString()}`
}

export function listEmployees(params?: ListEmployeesParams) {
  return apiFetch<EmployeeSummary[]>(`/employees${toQueryString(params)}`)
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
