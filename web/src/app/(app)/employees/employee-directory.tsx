"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PersonAvatar } from "@/components/person-avatar"
import { StatusIndicator } from "@/components/status-indicator"
import { Tag } from "@/components/tag"
import { departments } from "@/lib/departments"
import { departmentColor } from "@/lib/colors"
import { apiEmployeeStatusMeta } from "@/lib/status"
import { initials } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useEmployees } from "@/hooks/use-employees"
import { EmployeeFormDialog } from "./employee-form-dialog"

export function EmployeeDirectory() {
  const [query, setQuery] = useState("")
  const [department, setDepartment] = useState<string>("all")
  const role = useAuth().user?.role
  const canManageEmployees = role === "ADMIN" || role === "HR"

  const { data: response, isLoading, isError, error } = useEmployees({
    search: query.trim() || undefined,
    department: department === "all" ? undefined : department,
  })

  const filtered = useMemo(() => response?.items ?? [], [response?.items])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, or email..."
            className="h-8 w-72 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={department} onValueChange={(v) => setDepartment(v as string)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="Department">
              {(value: string) => (value === "all" ? "All departments" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} employee${filtered.length === 1 ? "" : "s"}`}
        </span>
        {canManageEmployees && (
          <EmployeeFormDialog mode="create" triggerRender={<Button size="sm" className="ml-auto" />}>
            <UserPlus />
            Add employee
          </EmployeeFormDialog>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load employees."}
                </TableCell>
              </TableRow>
            )}
            {!isError &&
              filtered.map((employee) => {
                const meta = apiEmployeeStatusMeta[employee.status]
                return (
                  <TableRow key={employee.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/employees/${employee.id}`} className="flex items-center gap-3">
                        <PersonAvatar
                          name={employee.name}
                          initials={initials(employee.name)}
                          className="size-8"
                          fallbackClassName="text-xs"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{employee.name}</span>
                          <span className="text-xs text-muted-foreground">{employee.title}</span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Tag color={departmentColor(employee.department)}>{employee.department}</Tag>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{employee.location ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{employee.manager?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusIndicator color={meta.color} label={meta.label} />
                    </TableCell>
                  </TableRow>
                )
              })}
            {!isError && !isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No employees match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
