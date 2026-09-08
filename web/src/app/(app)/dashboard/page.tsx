import Link from "next/link"
import { ArrowUpRight, Bot, Briefcase, CalendarDays, TrendingUp, Users } from "lucide-react"

import { SiteHeader } from "@/components/layout/site-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PersonAvatar } from "@/components/person-avatar"
import { Separator } from "@/components/ui/separator"
import { Tag } from "@/components/tag"
import {
  dashboardStats,
  employees,
  getEmployee,
  headcountByDepartment,
  leaveRequests,
  recentActivity,
} from "@/lib/mock-data"
import { statusColors } from "@/lib/status"
import { initials } from "@/lib/utils"
import { AttendanceTrendChart } from "./attendance-trend-chart"
import { DepartmentChart } from "./department-chart"

const statCards = [
  {
    label: "Total employees",
    value: dashboardStats.totalEmployees,
    icon: Users,
    delta: "+2 this month",
    color: "var(--cat-1)",
  },
  {
    label: "On leave today",
    value: dashboardStats.onLeaveToday,
    icon: CalendarDays,
    delta: `${leaveRequests.filter((r) => r.status === "pending").length} pending requests`,
    color: "var(--cat-2)",
  },
  {
    label: "Open positions",
    value: dashboardStats.openPositions,
    icon: Briefcase,
    delta: "3 in final interview",
    color: "var(--cat-3)",
  },
  {
    label: "Attendance rate",
    value: `${dashboardStats.attendanceRate}%`,
    icon: TrendingUp,
    delta: "vs 91% last week",
    color: "var(--cat-6)",
  },
]

export default function DashboardPage() {
  const pendingLeave = leaveRequests.filter((r) => r.status === "pending").slice(0, 4)

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Good morning, Girija</h2>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across the org today, Sep 2.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-start justify-between p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className="text-3xl font-semibold tracking-tight">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.delta}</span>
                </div>
                <div
                  className="flex size-8 items-center justify-center rounded-lg"
                  style={{
                    color: stat.color,
                    backgroundColor: `color-mix(in oklch, ${stat.color} 14%, transparent)`,
                  }}
                >
                  <stat.icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle>Attendance this week</CardTitle>
              <CardDescription>Employees present vs. on leave, last 7 working days</CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceTrendChart />
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Headcount by department</CardTitle>
              <CardDescription>{employees.length} employees across {headcountByDepartment.length} teams</CardDescription>
            </CardHeader>
            <CardContent>
              <DepartmentChart />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest actions across the workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                {recentActivity.map((item, i) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 py-2.5">
                      {item.actor === "System" ? (
                        <Avatar className="size-7">
                          <AvatarFallback className="text-muted-foreground">
                            <Bot className="size-3.5" />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <PersonAvatar
                          name={item.actor}
                          initials={initials(item.actor)}
                          className="size-7"
                          fallbackClassName="text-[10px]"
                        />
                      )}
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{item.actor}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>{" "}
                        <span className="font-medium">{item.target}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                    </div>
                    {i < recentActivity.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Pending leave</CardTitle>
                <CardDescription>Needs your approval</CardDescription>
              </div>
              <Link href="/leave" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                View all
                <ArrowUpRight />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {pendingLeave.map((req) => {
                  const employee = getEmployee(req.employeeId)
                  if (!employee) return null
                  return (
                    <div key={req.id} className="flex items-center gap-3">
                      <PersonAvatar
                        name={employee.name}
                        initials={initials(employee.name)}
                        className="size-7"
                        fallbackClassName="text-[10px]"
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.type} · {req.days} day{req.days > 1 ? "s" : ""}
                        </div>
                      </div>
                      <Tag color={statusColors.warning}>Pending</Tag>
                    </div>
                  )
                })}
                {pendingLeave.length === 0 && (
                  <p className="text-sm text-muted-foreground">No pending requests. You&apos;re all caught up.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
