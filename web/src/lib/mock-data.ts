export type EmployeeStatus = "active" | "on-leave" | "inactive"

export type Employee = {
  id: string
  name: string
  email: string
  title: string
  department: string
  location: string
  status: EmployeeStatus
  manager: string | null
  joinDate: string
  phone: string
}

export const departments = [
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "People",
  "Finance",
] as const

export const employees: Employee[] = [
  { id: "e-1001", name: "Ananya Rao", email: "ananya.rao@company.com", title: "VP of Engineering", department: "Engineering", location: "Bengaluru", status: "active", manager: null, joinDate: "2019-03-11", phone: "+91 98450 11223" },
  { id: "e-1002", name: "Diego Ramirez", email: "diego.ramirez@company.com", title: "Senior Backend Engineer", department: "Engineering", location: "Remote — Mexico City", status: "active", manager: "Ananya Rao", joinDate: "2021-06-01", phone: "+52 55 1234 5678" },
  { id: "e-1003", name: "Priya Menon", email: "priya.menon@company.com", title: "Frontend Engineer", department: "Engineering", location: "Bengaluru", status: "on-leave", manager: "Ananya Rao", joinDate: "2022-01-17", phone: "+91 90080 33445" },
  { id: "e-1004", name: "Wei Chen", email: "wei.chen@company.com", title: "Platform Engineer", department: "Engineering", location: "Singapore", status: "active", manager: "Ananya Rao", joinDate: "2020-09-23", phone: "+65 8123 4567" },
  { id: "e-1005", name: "Sarah Johnson", email: "sarah.johnson@company.com", title: "Head of Design", department: "Design", location: "London", status: "active", manager: null, joinDate: "2018-11-05", phone: "+44 7700 900123" },
  { id: "e-1006", name: "Kabir Malhotra", email: "kabir.malhotra@company.com", title: "Product Designer", department: "Design", location: "Bengaluru", status: "active", manager: "Sarah Johnson", joinDate: "2022-08-14", phone: "+91 99001 22334" },
  { id: "e-1007", name: "Emma Novak", email: "emma.novak@company.com", title: "VP of Sales", department: "Sales", location: "New York", status: "active", manager: null, joinDate: "2019-07-29", phone: "+1 212 555 0148" },
  { id: "e-1008", name: "Rahul Verma", email: "rahul.verma@company.com", title: "Account Executive", department: "Sales", location: "Mumbai", status: "on-leave", manager: "Emma Novak", joinDate: "2021-02-08", phone: "+91 98200 55667" },
  { id: "e-1009", name: "Olivia Brown", email: "olivia.brown@company.com", title: "Sales Development Rep", department: "Sales", location: "New York", status: "active", manager: "Emma Novak", joinDate: "2023-04-03", phone: "+1 212 555 0199" },
  { id: "e-1010", name: "Marcus Lee", email: "marcus.lee@company.com", title: "Marketing Manager", department: "Marketing", location: "Singapore", status: "active", manager: null, joinDate: "2020-05-19", phone: "+65 8234 5678" },
  { id: "e-1011", name: "Fatima Al-Sayed", email: "fatima.alsayed@company.com", title: "Content Strategist", department: "Marketing", location: "Remote — Dubai", status: "active", manager: "Marcus Lee", joinDate: "2022-10-11", phone: "+971 50 123 4567" },
  { id: "e-1012", name: "Girija Kuanr", email: "girija.kuanr@company.com", title: "HR Business Partner", department: "People", location: "Bengaluru", status: "active", manager: null, joinDate: "2021-01-25", phone: "+91 98765 43210" },
  { id: "e-1013", name: "Thomas Weber", email: "thomas.weber@company.com", title: "Talent Acquisition Lead", department: "People", location: "Berlin", status: "active", manager: "Girija Kuanr", joinDate: "2022-03-07", phone: "+49 30 1234567" },
  { id: "e-1014", name: "Nadia Petrova", email: "nadia.petrova@company.com", title: "Finance Controller", department: "Finance", location: "London", status: "active", manager: null, joinDate: "2019-09-16", phone: "+44 7700 900456" },
  { id: "e-1015", name: "Arjun Nair", email: "arjun.nair@company.com", title: "Financial Analyst", department: "Finance", location: "Bengaluru", status: "inactive", manager: "Nadia Petrova", joinDate: "2020-12-01", phone: "+91 90352 11009" },
]

export function getEmployee(id: string) {
  return employees.find((e) => e.id === id)
}

export type AttendanceStatus = "present" | "late" | "wfh" | "absent"

export type AttendanceRecord = {
  employeeId: string
  status: AttendanceStatus
  clockIn: string | null
  clockOut: string | null
  hours: number
}

const statusByIndex: AttendanceStatus[] = [
  "present", "present", "wfh", "present", "late", "present", "wfh",
  "present", "absent", "present", "present", "wfh", "present", "late", "present",
]

export const todayAttendance: AttendanceRecord[] = employees.map((e, i) => {
  const status = statusByIndex[i % statusByIndex.length]
  const clockIn = status === "absent" ? null : status === "late" ? "10:12 AM" : "09:0" + ((i % 5) + 1) + " AM"
  const clockOut = status === "absent" ? null : ["06:1" + (i % 5) + " PM", null][i % 6 === 0 ? 1 : 0]
  return {
    employeeId: e.id,
    status,
    clockIn,
    clockOut,
    hours: status === "absent" ? 0 : status === "late" ? 7.2 : 8.4,
  }
})

// Attendance trend for the last 7 working days: present vs on-leave headcount
export const attendanceTrend = [
  { day: "Aug 24", present: 13, onLeave: 2 },
  { day: "Aug 25", present: 14, onLeave: 1 },
  { day: "Aug 26", present: 12, onLeave: 3 },
  { day: "Aug 27", present: 13, onLeave: 2 },
  { day: "Aug 28", present: 11, onLeave: 4 },
  { day: "Sep 1", present: 14, onLeave: 1 },
  { day: "Sep 2", present: 13, onLeave: 2 },
]

export const headcountByDepartment = departments.map((d) => ({
  department: d,
  count: employees.filter((e) => e.department === d).length,
}))

export type LeaveType = "Annual" | "Sick" | "Work From Home" | "Unpaid"
export type LeaveStatus = "pending" | "approved" | "rejected"

export type LeaveRequest = {
  id: string
  employeeId: string
  type: LeaveType
  startDate: string
  endDate: string
  days: number
  status: LeaveStatus
  reason: string
  appliedOn: string
}

export const leaveRequests: LeaveRequest[] = [
  { id: "lv-2001", employeeId: "e-1003", type: "Sick", startDate: "2026-09-01", endDate: "2026-09-03", days: 3, status: "approved", reason: "Flu recovery", appliedOn: "2026-08-30" },
  { id: "lv-2002", employeeId: "e-1008", type: "Annual", startDate: "2026-09-02", endDate: "2026-09-06", days: 5, status: "approved", reason: "Family trip", appliedOn: "2026-08-20" },
  { id: "lv-2003", employeeId: "e-1006", type: "Work From Home", startDate: "2026-09-05", endDate: "2026-09-05", days: 1, status: "pending", reason: "Home repairs", appliedOn: "2026-09-02" },
  { id: "lv-2004", employeeId: "e-1011", type: "Annual", startDate: "2026-09-14", endDate: "2026-09-18", days: 5, status: "pending", reason: "Wedding", appliedOn: "2026-09-01" },
  { id: "lv-2005", employeeId: "e-1002", type: "Sick", startDate: "2026-08-25", endDate: "2026-08-25", days: 1, status: "approved", reason: "Doctor's appointment", appliedOn: "2026-08-24" },
  { id: "lv-2006", employeeId: "e-1009", type: "Unpaid", startDate: "2026-09-20", endDate: "2026-09-22", days: 3, status: "rejected", reason: "Personal travel", appliedOn: "2026-08-28" },
  { id: "lv-2007", employeeId: "e-1004", type: "Annual", startDate: "2026-10-01", endDate: "2026-10-05", days: 5, status: "pending", reason: "Vacation", appliedOn: "2026-09-02" },
  { id: "lv-2015", employeeId: "e-1013", type: "Sick", startDate: "2026-09-03", endDate: "2026-09-03", days: 1, status: "pending", reason: "Not feeling well", appliedOn: "2026-09-02" },
]

export type LeaveBalance = {
  employeeId: string
  annual: { used: number; total: number }
  sick: { used: number; total: number }
}

export const leaveBalances: LeaveBalance[] = employees.map((e, i) => ({
  employeeId: e.id,
  annual: { used: (i * 2) % 12, total: 18 },
  sick: { used: i % 5, total: 10 },
}))

export function getLeaveBalance(employeeId: string) {
  return leaveBalances.find((b) => b.employeeId === employeeId)
}

export const recentActivity = [
  { id: "a-1", actor: "Girija Kuanr", action: "approved leave request for", target: "Rahul Verma", time: "10 min ago" },
  { id: "a-2", actor: "System", action: "flagged a late clock-in for", target: "Wei Chen", time: "1 hour ago" },
  { id: "a-3", actor: "Thomas Weber", action: "moved candidate to interview for", target: "Senior Backend Engineer", time: "2 hours ago" },
  { id: "a-4", actor: "Kabir Malhotra", action: "submitted a WFH request", target: "for Sep 5", time: "3 hours ago" },
  { id: "a-5", actor: "Nadia Petrova", action: "closed the payroll run for", target: "August", time: "Yesterday" },
]

export const dashboardStats = {
  totalEmployees: employees.length,
  onLeaveToday: todayAttendance.filter((a) => a.status === "absent").length + 1,
  openPositions: 4,
  attendanceRate: Math.round(
    (todayAttendance.filter((a) => a.status !== "absent").length / todayAttendance.length) * 100
  ),
}
