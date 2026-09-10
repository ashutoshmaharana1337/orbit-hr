"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Briefcase, Building2, CalendarDays, Users } from "lucide-react"

import { SiteHeader } from "@/components/layout/site-header"
import { PersonAvatar } from "@/components/person-avatar"
import { StatusIndicator } from "@/components/status-indicator"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { departments } from "@/lib/departments"
import { departmentColor } from "@/lib/colors"
import { initials } from "@/lib/utils"
import { apiEmployeeStatusMeta } from "@/lib/status"
import { useEmployees } from "@/hooks/use-employees"

export default function DepartmentLandingPage() {
  const { department: slug } = useParams<{ department: string }>()
  const knownDepartment = departments.find((d) => d.toLowerCase() === slug.toLowerCase())

  const { data: deptEmployees, isLoading } = useEmployees({ department: knownDepartment ?? slug })

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader title="Department" />
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    )
  }

  const employeesList = deptEmployees ?? []

  if (!knownDepartment && employeesList.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader title="Department" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <p>Department not found.</p>
          <Link href="/dashboard" className="text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const displayName = knownDepartment ?? employeesList[0]?.department ?? slug
  const onLeave = employeesList.filter((e) => e.status === "ON_LEAVE").length
  const leads = employeesList.filter((e) => e.managerId === null).length
  const reports = employeesList.length - leads
  const accent = departmentColor(displayName)

  const stats = [
    { label: "Team members", value: employeesList.length, icon: Users, color: "var(--cat-1)" },
    { label: "On leave", value: onLeave, icon: CalendarDays, color: "var(--cat-2)" },
    { label: "Team leads", value: leads, icon: Briefcase, color: "var(--cat-3)" },
    { label: "Direct reports", value: reports, icon: Users, color: "var(--cat-6)" },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title={displayName} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-lg"
              style={{
                color: accent,
                backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)`,
              }}
            >
              <Building2 className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{displayName} team overview</p>
            </div>
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
            Go to full dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-start justify-between p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className="text-3xl font-semibold tracking-tight">{stat.value}</span>
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

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>
              Everyone in {displayName}, {employeesList.length} member{employeesList.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {employeesList.map((employee) => {
                const meta = apiEmployeeStatusMeta[employee.status]
                return (
                  <Link
                    key={employee.id}
                    href={`/employees/${employee.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <PersonAvatar
                      name={employee.name}
                      initials={initials(employee.name)}
                      className="size-9"
                      fallbackClassName="text-xs"
                    />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm leading-tight font-medium">{employee.name}</span>
                      <span className="text-xs leading-tight text-muted-foreground">{employee.title}</span>
                      <StatusIndicator color={meta.color} label={meta.label} className="mt-1 text-xs" />
                    </div>
                  </Link>
                )
              })}
              {employeesList.length === 0 && (
                <p className="text-sm text-muted-foreground">No employees in this department yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
