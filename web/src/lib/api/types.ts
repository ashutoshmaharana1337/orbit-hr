// Hand-mirrored against api/src — there's no shared-types package between the
// two apps yet (see docs/production-readiness-review.html phase 2). Keep
// these in sync with api/prisma/schema.prisma and the employees DTOs.

export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE"

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE"

// What GET /employees returns per row. Non-privileged viewers (an EMPLOYEE
// looking at a colleague) get only the fields in PUBLIC_DIRECTORY_FIELDS on
// the API side — everything else is legitimately absent, not just unfetched.
export type EmployeeSummary = {
  id: string
  name: string
  title: string
  department: string
  status: EmployeeStatus
  managerId: string | null
  manager?: { id: string; name: string } | null
  email?: string
  location?: string
  phone?: string
  joinDate?: string
}

export type EmployeeDetail = EmployeeSummary & {
  email: string
  location: string
  joinDate: string
  phone?: string
  reports?: { id: string; name: string; title: string }[]
  leaveBalance?: {
    annualUsed: number
    annualTotal: number
    sickUsed: number
    sickTotal: number
  } | null
}

export type CreateEmployeeInput = {
  name: string
  email: string
  title: string
  department: string
  location: string
  status?: EmployeeStatus
  managerId?: string
  joinDate: string
  phone: string
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>

export type ListEmployeesParams = {
  search?: string
  department?: string
  status?: EmployeeStatus
}

export type AttendanceStatus = "PRESENT" | "LATE" | "WFH" | "ABSENT"

// What GET /attendance/today returns per row — always tenant-wide, not
// role-filtered (see api/src/attendance/attendance.controller.ts).
export type AttendanceRecord = {
  id: string
  employeeId: string
  date: string
  status: AttendanceStatus
  clockIn: string | null
  clockOut: string | null
  hours: number
  employee: { id: string; name: string; department: string }
}

export type AttendanceSummaryEntry = {
  status: AttendanceStatus
  count: number
}
