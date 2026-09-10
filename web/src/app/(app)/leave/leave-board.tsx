"use client"

import { useState } from "react"
import { Check, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PersonAvatar } from "@/components/person-avatar"
import { StatusIndicator } from "@/components/status-indicator"
import { Tag } from "@/components/tag"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { initials } from "@/lib/utils"
import { leaveTypeColor } from "@/lib/colors"
import { apiLeaveStatusMeta } from "@/lib/status"
import { LEAVE_TYPE_LABEL } from "@/lib/leave"
import { ApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import {
  useApproveLeave,
  useCreateLeaveRequest,
  useLeaveRequests,
  useRejectLeave,
} from "@/hooks/use-leave"
import type { LeaveRequestListEntry, LeaveStatus, LeaveType } from "@/lib/api/types"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function LeaveActions({ request }: { request: LeaveRequestListEntry }) {
  const approve = useApproveLeave()
  const reject = useRejectLeave()
  const [error, setError] = useState<string | null>(null)
  const pending = approve.isPending || reject.isPending

  async function onApprove() {
    setError(null)
    try {
      await approve.mutateAsync(request.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't approve. Try again.")
    }
  }

  async function onReject() {
    setError(null)
    try {
      await reject.mutateAsync(request.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reject. Try again.")
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1.5">
        <Button
          size="icon-sm"
          variant="outline"
          disabled={pending}
          className="text-[#0ca30c] hover:text-[#0ca30c]"
          onClick={onApprove}
        >
          <Check />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          disabled={pending}
          className="text-[#d03b3b] hover:text-[#d03b3b]"
          onClick={onReject}
        >
          <X />
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

const EMPTY_FORM = { type: "ANNUAL" as LeaveType, startDate: "", endDate: "", reason: "" }

export function LeaveBoard() {
  const { user } = useAuth()
  const canDecide = user?.role === "ADMIN" || user?.role === "HR" || user?.role === "MANAGER"

  const [tab, setTab] = useState<"all" | LeaveStatus>("all")
  const { data: requests, isLoading, isError, error } = useLeaveRequests(
    tab === "all" ? undefined : { status: tab }
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const createLeave = useCreateLeaveRequest()

  function onDialogOpenChange(next: boolean) {
    setDialogOpen(next)
    if (next) {
      setForm(EMPTY_FORM)
      setDialogError(null)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDialogError(null)
    try {
      await createLeave.mutateAsync(form)
      setDialogOpen(false)
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : "Couldn't submit request. Try again.")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus />
            Request leave
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onSubmit}>
              <DialogHeader>
                <DialogTitle>Request leave</DialogTitle>
                <DialogDescription>
                  Submit a new leave request for your manager to approve.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="leave-type">Leave type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as LeaveType }))}
                  >
                    <SelectTrigger id="leave-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {LEAVE_TYPE_LABEL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="start-date">Start date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      required
                      value={form.startDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="end-date">End date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      required
                      value={form.endDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    placeholder="Briefly describe the reason"
                    required
                    value={form.reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={createLeave.isPending}>
                  {createLeave.isPending ? "Submitting…" : "Submit request"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load leave requests."}
                </TableCell>
              </TableRow>
            )}
            {!isError &&
              requests?.map((req) => {
                const meta = apiLeaveStatusMeta[req.status]
                const sameDay = formatDate(req.startDate) === formatDate(req.endDate)
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          name={req.employee.name}
                          initials={initials(req.employee.name)}
                          className="size-8"
                          fallbackClassName="text-xs"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{req.employee.name}</span>
                          <span className="text-xs text-muted-foreground">{req.employee.department}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tag color={leaveTypeColor(LEAVE_TYPE_LABEL[req.type])}>{LEAVE_TYPE_LABEL[req.type]}</Tag>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sameDay ? formatDate(req.startDate) : `${formatDate(req.startDate)} → ${formatDate(req.endDate)}`}{" "}
                      <span className="text-xs">
                        ({req.days} day{req.days > 1 ? "s" : ""})
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">{req.reason}</TableCell>
                    <TableCell>
                      <StatusIndicator color={meta.color} label={meta.label} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canDecide && req.status === "PENDING" ? (
                        <LeaveActions request={req} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            {!isError && !isLoading && (requests?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No requests in this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
