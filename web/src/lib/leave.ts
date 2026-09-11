import type { LeaveType } from "./api/types"

// The real API's LeaveType enum is uppercase-snake; colors.ts's
// leaveTypeColor() is keyed by these human labels — map before calling it
// rather than teaching colors.ts a second, uppercase key set.
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: "Annual",
  SICK: "Sick",
  WORK_FROM_HOME: "Work From Home",
  UNPAID: "Unpaid",
}
