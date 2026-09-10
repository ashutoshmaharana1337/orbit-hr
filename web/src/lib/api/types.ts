// Hand-mirrored against api/src — there's no shared-types package between the
// two apps yet (see docs/production-readiness-review.html phase 2). Keep
// these in sync with api/prisma/schema.prisma and the employees DTOs.

export type Role = "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE"

export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE"
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED"
export type LeaveType = "ANNUAL" | "SICK" | "WORK_FROM_HOME" | "UNPAID"
export type AttendanceStatus = "PRESENT" | "LATE" | "WFH" | "ABSENT"

// Cursor-based pagination response wrapper
export interface CursorPaginatedResponse<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

// Department type for the Department model
export type Department = {
  id: string
  name: string
  description?: string
}

// Leave policy type (for future use when department-based policies are added)
export type LeavePolicy = {
  type: LeaveType
  total: number
  used: number
}

// What GET /employees returns per row. Non-privileged viewers (an EMPLOYEE
// looking at a colleague) get only the fields in PUBLIC_DIRECTORY_FIELDS on
// the API side — everything else is legitimately absent, not just unfetched.
export type EmployeeSummary = {
  id: string
  name: string
  title: string
  departmentId?: string
  department?: { id: string; name: string } | null
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
  cursor?: string
  limit?: number
}


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

export type AttendanceTrendEntry = {
  day: string
  present: number
  onLeave: number
}

// What POST /leave, PATCH /leave/:id/approve, and PATCH /leave/:id/reject
// return — no `employee` include on those responses.
export type LeaveRequestRecord = {
  id: string
  employeeId: string
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  status: LeaveStatus
  reason: string
  appliedOn: string
  decidedAt: string | null
  decidedBy: string | null
}

// What GET /leave returns per row — same fields, plus the joined employee.
export type LeaveRequestListEntry = LeaveRequestRecord & {
  employee: { id: string; name: string; department: string }
}

export type LeaveBalance = {
  id: string
  employeeId: string
  annualUsed: number
  annualTotal: number
  sickUsed: number
  sickTotal: number
}

export type CreateLeaveRequestInput = {
  type: LeaveType
  startDate: string
  endDate: string
  reason: string
}

export type ListLeaveParams = {
  status?: LeaveStatus
  employeeId?: string
  cursor?: string
  limit?: number
}

export type DashboardStats = {
  totalEmployees: number
  onLeaveToday: number
  pendingLeaveRequests: number
  attendanceRate: number
  headcountByDepartment: { department: string; count: number }[]
}

export type ListDepartmentsParams = {
  search?: string
  cursor?: string
  limit?: number
}

export type ListLeavePoliciesParams = {
  cursor?: string
  limit?: number
}
