import { notFound } from "next/navigation"
import { Briefcase, Calendar, Mail, MapPin, Phone } from "lucide-react"

import { SiteHeader } from "@/components/layout/site-header"
import { PersonAvatar } from "@/components/person-avatar"
import { StatusIndicator } from "@/components/status-indicator"
import { Tag } from "@/components/tag"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  employees,
  getEmployee,
  getLeaveBalance,
  initials,
  leaveRequests,
  todayAttendance,
} from "@/lib/mock-data"
import { departmentColor, leaveTypeColor } from "@/lib/colors"
import { attendanceStatusMeta, employeeStatusMeta, leaveStatusMeta } from "@/lib/status"

export function generateStaticParams() {
  return employees.map((e) => ({ id: e.id }))
}

export default async function EmployeeProfilePage(props: PageProps<"/employees/[id]">) {
  const { id } = await props.params
  const employee = getEmployee(id)
  if (!employee) notFound()

  const statusMeta = employeeStatusMeta[employee.status]
  const balance = getLeaveBalance(employee.id)
  const attendance = todayAttendance.find((a) => a.employeeId === employee.id)
  const employeeLeaveHistory = leaveRequests.filter((r) => r.employeeId === employee.id)
  const reports = employees.filter((e) => e.manager === employee.name)

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Employees" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <PersonAvatar
                name={employee.name}
                initials={initials(employee.name)}
                className="size-16"
                fallbackClassName="text-lg"
              />
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">{employee.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {employee.title} · {employee.department}
                </p>
                <StatusIndicator color={statusMeta.color} label={statusMeta.label} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:text-right">
              <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                <Mail className="size-3.5" />
                {employee.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                <Phone className="size-3.5" />
                {employee.phone}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                <MapPin className="size-3.5" />
                {employee.location}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                <Calendar className="size-3.5" />
                Joined {new Date(employee.joinDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave history</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Job details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Manager</span>
                  <span>{employee.manager ?? "—"}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <Tag color={departmentColor(employee.department)}>{employee.department}</Tag>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Employee ID</span>
                  <span className="font-mono text-xs">{employee.id}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave balance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {balance && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>Annual leave</span>
                        <span className="text-muted-foreground">
                          {balance.annual.used} / {balance.annual.total} days
                        </span>
                      </div>
                      <Progress value={(balance.annual.used / balance.annual.total) * 100} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>Sick leave</span>
                        <span className="text-muted-foreground">
                          {balance.sick.used} / {balance.sick.total} days
                        </span>
                      </div>
                      <Progress value={(balance.sick.used / balance.sick.total) * 100} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Briefcase className="size-3.5" />
                  Direct reports ({reports.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {reports.length === 0 && (
                  <p className="text-sm text-muted-foreground">No direct reports.</p>
                )}
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 text-sm">
                    <PersonAvatar
                      name={r.name}
                      initials={initials(r.name)}
                      className="size-6"
                      fallbackClassName="text-[10px]"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium leading-tight">{r.name}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{r.title}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Today</CardTitle>
              </CardHeader>
              <CardContent>
                {attendance ? (
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <StatusIndicator
                      color={attendanceStatusMeta[attendance.status].color}
                      label={attendanceStatusMeta[attendance.status].label}
                    />
                    <div className="text-muted-foreground">
                      Clock in: <span className="text-foreground">{attendance.clockIn ?? "—"}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Clock out: <span className="text-foreground">{attendance.clockOut ?? "—"}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Hours logged: <span className="text-foreground">{attendance.hours}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attendance record for today.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card>
              <CardContent className="flex flex-col p-0">
                {employeeLeaveHistory.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground">No leave requests on file.</p>
                )}
                {employeeLeaveHistory.map((req, i) => (
                  <div key={req.id}>
                    <div className="flex items-center justify-between p-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <Tag color={leaveTypeColor(req.type)}>{req.type}</Tag>
                        <span className="text-xs text-muted-foreground">
                          {req.startDate} → {req.endDate} · {req.days} day{req.days > 1 ? "s" : ""}
                        </span>
                      </div>
                      <StatusIndicator
                        color={leaveStatusMeta[req.status].color}
                        label={leaveStatusMeta[req.status].label}
                      />
                    </div>
                    {i < employeeLeaveHistory.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
