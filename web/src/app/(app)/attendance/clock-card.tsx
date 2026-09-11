"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusIndicator } from "@/components/status-indicator"
import { ApiError } from "@/lib/api-client"
import { apiAttendanceStatusMeta } from "@/lib/status"
import { useAuth } from "@/lib/auth-context"
import { useClockIn, useClockOut, useTodayAttendance } from "@/hooks/use-attendance"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function ClockCard() {
  const { employee } = useAuth()
  const { data: today, isLoading } = useTodayAttendance()
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const [error, setError] = React.useState<string | null>(null)

  if (!employee) return null

  const record = today?.find((r) => r.employeeId === employee.id)
  const pending = clockIn.isPending || clockOut.isPending

  async function onClockIn() {
    setError(null)
    try {
      await clockIn.mutateAsync()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't clock in. Try again.")
    }
  }

  async function onClockOut() {
    setError(null)
    try {
      await clockOut.mutateAsync()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't clock out. Try again.")
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            {isLoading ? (
              <span className="text-sm text-muted-foreground">Checking today&apos;s status…</span>
            ) : !record ? (
              <span className="text-sm">You haven&apos;t clocked in today.</span>
            ) : !record.clockOut ? (
              <div className="flex items-center gap-2 text-sm">
                <StatusIndicator
                  color={apiAttendanceStatusMeta[record.status].color}
                  label={apiAttendanceStatusMeta[record.status].label}
                />
                <span className="text-muted-foreground">
                  {record.clockIn ? `Clocked in at ${formatTime(record.clockIn)}` : "Clocked in"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span>Done for today</span>
                <span className="text-muted-foreground">
                  {record.clockIn ? `${formatTime(record.clockIn)} – ` : ""}
                  {formatTime(record.clockOut)} · {record.hours} hrs
                </span>
              </div>
            )}
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        </div>

        {!isLoading && !record?.clockOut && (
          <Button
            size="sm"
            variant={record ? "outline" : "default"}
            disabled={pending}
            onClick={record ? onClockOut : onClockIn}
          >
            {pending ? "Saving…" : record ? "Clock out" : "Clock in"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
