"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Briefcase, Calendar, Mail, MapPin, Pencil, Phone } from "lucide-react"

import { SiteHeader } from "@/components/layout/site-header"
import { PersonAvatar } from "@/components/person-avatar"
import { StatusIndicator } from "@/components/status-indicator"
import { Tag } from "@/components/tag"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { departmentColor } from "@/lib/colors"
import { formatDate } from "@/lib/format"
import { apiEmployeeStatusMeta } from "@/lib/status"
import { initials } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useDepartments } from "@/hooks/use-departments"
import { useEmployee } from "@/hooks/use-employees"
import { useLeaveBalance } from "@/hooks/use-leave"
import { ApiError } from "@/lib/api-client"
import { EmployeeFormDialog } from "../employee-form-dialog"

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: employee, isLoading, error } = useEmployee(id)
  // Balances come from /leave/balance/:id (one row per policy). The API
  // 403s for viewers who may not see them — we just hide the card then.
  const { data: leaveBalances, isError: balancesError } = useLeaveBalance(id)
  const { data: departmentsResponse } = useDepartments()
  const departmentName =
    employee?.department?.name ??
    (employee?.departmentId
      ? departmentsResponse?.items.find((d) => d.id === employee.departmentId)?.name
      : undefined)

  const canManageEmployees = user?.role === "ADMIN" || user?.role === "HR"

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader title="Employees" />
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    )
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader title="Employees" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <p>Employee not found.</p>
          <Link href="/employees" className="text-primary hover:underline">
            Back to directory
          </Link>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader title="Employees" />
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load this employee."}
        </div>
      </div>
    )
  }

  const statusMeta = apiEmployeeStatusMeta[employee.status]
  const canEdit = canManageEmployees

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
                  {employee.title} · {departmentName ?? "—"}
                </p>
                <StatusIndicator color={statusMeta.color} label={statusMeta.label} className="mt-1" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              {canEdit && (
                <EmployeeFormDialog
                  mode="edit"
                  employee={employee}
                  triggerRender={<Button variant="outline" size="sm" />}
                >
                  <Pencil />
                  Edit
                </EmployeeFormDialog>
              )}
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:text-right">
                {employee.email && (
                  <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                    <Mail className="size-3.5" />
                    {employee.email}
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                    <Phone className="size-3.5" />
                    {employee.phone}
                  </div>
                )}
                {employee.location && (
                  <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                    <MapPin className="size-3.5" />
                    {employee.location}
                  </div>
                )}
                {employee.joinDate && (
                  <div className="flex items-center gap-2 text-muted-foreground sm:justify-end">
                    <Calendar className="size-3.5" />
                    {/* joinDate is a calendar date stored at UTC midnight —
                        format in UTC so it never shifts a day west of Greenwich. */}
                    Joined {formatDate(employee.joinDate, "UTC", { year: "numeric" })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Manager</span>
                <span>{employee.manager?.name ?? "—"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department</span>
                {departmentName ? (
                  <Tag color={departmentColor(departmentName)}>{departmentName}</Tag>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employee ID</span>
                <span className="font-mono text-xs">{employee.id}</span>
              </div>
            </CardContent>
          </Card>

          {!balancesError && leaveBalances && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave balance</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {leaveBalances.length === 0 && (
                  <p className="text-sm text-muted-foreground">No leave policies assigned yet.</p>
                )}
                {leaveBalances.map((balance) => {
                  // entitledDays can be 0 (unallocated policy) — avoid NaN.
                  const percent =
                    balance.entitledDays > 0
                      ? Math.min(100, (balance.usedDays / balance.entitledDays) * 100)
                      : 0
                  return (
                    <div key={balance.policy.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{balance.policy.name}</span>
                        <span className="text-muted-foreground">
                          {balance.usedDays} / {balance.entitledDays} days
                        </span>
                      </div>
                      <Progress value={percent} aria-label={`${balance.policy.name} used`} />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {employee.reports !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Briefcase className="size-3.5" />
                  Direct reports ({employee.reports.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {employee.reports.length === 0 && (
                  <p className="text-sm text-muted-foreground">No direct reports.</p>
                )}
                {employee.reports.map((r) => (
                  <Link
                    key={r.id}
                    href={`/employees/${r.id}`}
                    className="flex items-center gap-2.5 text-sm hover:underline"
                  >
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
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
