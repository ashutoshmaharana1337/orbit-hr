"use client"

import Link from "next/link"
import { ArrowUpRight, CalendarDays, TrendingUp, Users } from "lucide-react"

import { SiteHeader } from "@/components/layout/site-header"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PersonAvatar } from "@/components/person-avatar"
import { Tag } from "@/components/tag"
import { statusColors } from "@/lib/status"
import { initials } from "@/lib/utils"
import { LEAVE_TYPE_LABEL } from "@/lib/leave"
import { useAuth } from "@/lib/auth-context"
import { useDashboardStats } from "@/hooks/use-dashboard"
import { useLeaveRequests } from "@/hooks/use-leave"
import { AttendanceTrendChart } from "./attendance-trend-chart"
import { DepartmentChart } from "./department-chart"

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: pendingLeave, isLoading: pendingLoading } = useLeaveRequests({ status: "PENDING" })

  const firstName = user?.employee?.name.split(" ")[0] ?? user?.email ?? ""
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })

  const statCards = stats && [
    { label: "Total employees", value: stats.totalEmployees, icon: Users, color: "var(--cat-1)" },
    {
      label: "On leave today",
      value: stats.onLeaveToday,
      icon: CalendarDays,
      delta: `${stats.pendingLeaveRequests} pending request${stats.pendingLeaveRequests === 1 ? "" : "s"}`,
      color: "var(--cat-2)",
    },
    { label: "Attendance rate", value: `${stats.attendanceRate}%`, icon: TrendingUp, color: "var(--cat-6)" },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Good morning, {firstName}</h2>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across the org today, {today}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statsLoading || !statCards
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 text-sm text-muted-foreground">Loading…</CardContent>
                </Card>
              ))
            : statCards.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="flex items-start justify-between p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <span className="text-3xl font-semibold tracking-tight">{stat.value}</span>
                      {"delta" in stat && (
                        <span className="text-xs text-muted-foreground">{stat.delta}</span>
                      )}
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
              <CardDescription>
                {stats?.totalEmployees ?? 0} employees across {stats?.headcountByDepartment.length ?? 0} teams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DepartmentChart />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-5">
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
                {pendingLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {!pendingLoading &&
                  pendingLeave?.items?.slice(0, 4).map((req) => (
                    <div key={req.id} className="flex items-center gap-3">
                      <PersonAvatar
                        name={req.employee.name}
                        initials={initials(req.employee.name)}
                        className="size-7"
                        fallbackClassName="text-[10px]"
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{req.employee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {LEAVE_TYPE_LABEL[req.type]} · {req.days} day{req.days > 1 ? "s" : ""}
                        </div>
                      </div>
                      <Tag color={statusColors.warning}>Pending</Tag>
                    </div>
                  ))}
                {!pendingLoading && (pendingLeave?.items?.length ?? 0) === 0 && (
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
