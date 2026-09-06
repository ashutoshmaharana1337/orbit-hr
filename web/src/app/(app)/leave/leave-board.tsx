"use client"

import { useMemo, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getEmployee, initials, leaveRequests as initialRequests, type LeaveRequest, type LeaveStatus } from "@/lib/mock-data"
import { leaveTypeColor } from "@/lib/colors"
import { leaveStatusMeta } from "@/lib/status"

export function LeaveBoard() {
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
  const [tab, setTab] = useState<"all" | LeaveStatus>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = useMemo(
    () => (tab === "all" ? requests : requests.filter((r) => r.status === tab)),
    [requests, tab]
  )

  function updateStatus(id: string, status: LeaveStatus) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus />
            Request leave
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request leave</DialogTitle>
              <DialogDescription>
                Submit a new leave request for approval. This is a demo form — nothing is saved.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="leave-type">Leave type</Label>
                <Select defaultValue="Annual">
                  <SelectTrigger id="leave-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Sick">Sick</SelectItem>
                    <SelectItem value="Work From Home">Work From Home</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="start-date">Start date</Label>
                  <Input id="start-date" type="date" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="end-date">End date</Label>
                  <Input id="end-date" type="date" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" placeholder="Briefly describe the reason" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={() => setDialogOpen(false)}>Submit request</Button>
            </DialogFooter>
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
            {filtered.map((req) => {
              const employee = getEmployee(req.employeeId)
              if (!employee) return null
              const meta = leaveStatusMeta[req.status]
              return (
                <TableRow key={req.id}>
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
                    <Tag color={leaveTypeColor(req.type)}>{req.type}</Tag>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {req.startDate === req.endDate
                      ? req.startDate
                      : `${req.startDate} → ${req.endDate}`}{" "}
                    <span className="text-xs">
                      ({req.days} day{req.days > 1 ? "s" : ""})
                    </span>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{req.reason}</TableCell>
                  <TableCell>
                    <StatusIndicator color={meta.color} label={meta.label} />
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === "pending" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-[#0ca30c] hover:text-[#0ca30c]"
                          onClick={() => updateStatus(req.id, "approved")}
                        >
                          <Check />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-[#d03b3b] hover:text-[#d03b3b]"
                          onClick={() => updateStatus(req.id, "rejected")}
                        >
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
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
