import { SiteHeader } from "@/components/layout/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { todayAttendance } from "@/lib/mock-data"
import { attendanceStatusMeta } from "@/lib/status"
import { AttendanceTable } from "./attendance-table"

const summary = (["present", "late", "wfh", "absent"] as const).map((status) => ({
  status,
  meta: attendanceStatusMeta[status],
  count: todayAttendance.filter((a) => a.status === status).length,
}))

export default function AttendancePage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Attendance" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Today · Sep 2, 2026</h2>
          <p className="text-sm text-muted-foreground">
            Live clock-in status for all {todayAttendance.length} employees.
          </p>
        </div>

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
