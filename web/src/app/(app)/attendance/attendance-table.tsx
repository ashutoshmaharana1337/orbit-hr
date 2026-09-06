"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
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
import { getEmployee, initials, todayAttendance } from "@/lib/mock-data"
import { attendanceStatusMeta } from "@/lib/status"

export function AttendanceTable() {
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return todayAttendance
      .map((record) => ({ record, employee: getEmployee(record.employeeId) }))
      .filter(({ employee }) => employee && (!q || employee.name.toLowerCase().includes(q)))
  }, [query])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          className="h-8 w-72 pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ record, employee }) => {
              if (!employee) return null
              const meta = attendanceStatusMeta[record.status]
              return (
                <TableRow key={record.employeeId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PersonAvatar
                        name={employee.name}
                        initials={initials(employee.name)}
                        className="size-8"
                        fallbackClassName="text-xs"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{employee.name}</span>
                        <span className="text-xs text-muted-foreground">{employee.department}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusIndicator color={meta.color} label={meta.label} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.clockIn ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{record.clockOut ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {record.hours || "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
