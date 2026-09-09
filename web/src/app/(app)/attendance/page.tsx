"use client"

import { SiteHeader } from "@/components/layout/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { apiAttendanceStatusMeta } from "@/lib/status"
import { useAttendanceSummary, useTodayAttendance } from "@/hooks/use-attendance"
import { useEmployees } from "@/hooks/use-employees"
import { AttendanceTable } from "./attendance-table"
import { ClockCard } from "./clock-card"

const STATUSES = (["PRESENT", "LATE", "WFH", "ABSENT"] as const)

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
})

export default function AttendancePage() {
  const { data: summaryData } = useAttendanceSummary()
  const { data: todayAttendance } = useTodayAttendance()
  const { data: employees } = useEmployees()

  const summary = STATUSES.map((status) => ({
    status,
    meta: apiAttendanceStatusMeta[status],
    count: summaryData?.find((s) => s.status === status)?.count ?? 0,
  }))

  const clockedIn = todayAttendance?.length ?? 0
  const total = employees?.length

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Attendance" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Today · {today}</h2>
          <p className="text-sm text-muted-foreground">
            {total !== undefined
              ? `${clockedIn} of ${total} employees have clocked in today.`
              : `${clockedIn} employees have clocked in today.`}
          </p>
        </div>

        <ClockCard />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.map((s) => (
            <Card key={s.status}>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-sm text-muted-foreground">{s.meta.label}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">{s.count}</span>
                  <span className="text-xs text-muted-foreground">employees</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <AttendanceTable />
      </div>
    </div>
  )
}
