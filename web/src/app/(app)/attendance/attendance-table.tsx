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
import { initials } from "@/lib/utils"
import { apiAttendanceStatusMeta } from "@/lib/status"
import { useTodayAttendance } from "@/hooks/use-attendance"

function formatTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function AttendanceTable() {
  const [query, setQuery] = useState("")
  const { data: records, isLoading, isError, error } = useTodayAttendance()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (records ?? []).filter((r) => !q || r.employee.name.toLowerCase().includes(q))
  }, [records, query])

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
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load attendance."}
                </TableCell>
              </TableRow>
            )}
            {!isError &&
              rows.map(({ id, employee, status, clockIn, clockOut, hours }) => {
                const meta = apiAttendanceStatusMeta[status]
                return (
                  <TableRow key={id}>
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
                    <TableCell className="text-muted-foreground">{formatTime(clockIn)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatTime(clockOut)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {hours || "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            {!isError && !isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {records?.length ? "No employees match your search." : "No one has clocked in today yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
