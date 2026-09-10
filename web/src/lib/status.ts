export const statusColors = {
  good: "#0ca30c",
  warning: "#c98500",
  serious: "#ec835a",
  critical: "#d03b3b",
  info: "#2a78d6",
  neutral: "#898781",
} as const

export const employeeStatusMeta = {
  active: { color: statusColors.good, label: "Active" },
  "on-leave": { color: statusColors.warning, label: "On leave" },
  inactive: { color: statusColors.neutral, label: "Inactive" },
} as const

// Same as employeeStatusMeta, keyed by the real API's UPPERCASE enum
// (EmployeeStatus in lib/api/types.ts) instead of mock-data's lowercase one.
export const apiEmployeeStatusMeta = {
  ACTIVE: { color: statusColors.good, label: "Active" },
  ON_LEAVE: { color: statusColors.warning, label: "On leave" },
  INACTIVE: { color: statusColors.neutral, label: "Inactive" },
} as const

export const attendanceStatusMeta = {
  present: { color: statusColors.good, label: "Present" },
  late: { color: statusColors.warning, label: "Late" },
  wfh: { color: statusColors.info, label: "Work from home" },
  absent: { color: statusColors.critical, label: "Absent" },
} as const

// Same as attendanceStatusMeta, keyed by the real API's UPPERCASE enum
// (AttendanceStatus in lib/api/types.ts) instead of mock-data's lowercase one.
export const apiAttendanceStatusMeta = {
  PRESENT: { color: statusColors.good, label: "Present" },
  LATE: { color: statusColors.warning, label: "Late" },
  WFH: { color: statusColors.info, label: "Work from home" },
  ABSENT: { color: statusColors.critical, label: "Absent" },
} as const

// Keyed by the real API's UPPERCASE enum (LeaveStatus in lib/api/types.ts).
export const apiLeaveStatusMeta = {
  PENDING: { color: statusColors.warning, label: "Pending" },
  APPROVED: { color: statusColors.good, label: "Approved" },
  REJECTED: { color: statusColors.critical, label: "Rejected" },
} as const
