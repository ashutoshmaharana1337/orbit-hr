"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { departments } from "@/lib/departments"
import { ApiError } from "@/lib/api-client"
import type { CreateEmployeeInput, EmployeeDetail, EmployeeStatus } from "@/lib/api/types"
import { useCreateEmployee, useEmployees, useUpdateEmployee } from "@/hooks/use-employees"

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  INACTIVE: "Inactive",
}

const NO_MANAGER = "none"

type FormState = {
  name: string
  email: string
  title: string
  department: string
  location: string
  status: EmployeeStatus
  managerId: string
  joinDate: string
  phone: string
}

function toFormState(employee?: EmployeeDetail): FormState {
  return {
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    title: employee?.title ?? "",
    department: employee?.department ?? departments[0],
    location: employee?.location ?? "",
    status: employee?.status ?? "ACTIVE",
    managerId: employee?.managerId ?? NO_MANAGER,
    joinDate: employee?.joinDate ? employee.joinDate.slice(0, 10) : "",
    phone: employee?.phone ?? "",
  }
}

type EmployeeFormDialogProps = {
  mode: "create" | "edit"
  employee?: EmployeeDetail
  /** Element the DialogTrigger renders as, e.g. `<Button size="sm" />` */
  triggerRender: React.ReactElement
  /** Visible content of the trigger, e.g. `<><UserPlus /> Add employee</>` */
  children: React.ReactNode
}

export function EmployeeFormDialog({
  mode,
  employee,
  triggerRender,
  children,
}: EmployeeFormDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(() => toFormState(employee))
  const [error, setError] = React.useState<string | null>(null)

  const managerOptions = useEmployees()
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee(employee?.id ?? "")
  const pending = createEmployee.isPending || updateEmployee.isPending

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setForm(toFormState(employee))
      setError(null)
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const input: CreateEmployeeInput = {
      name: form.name,
      email: form.email,
      title: form.title,
      department: form.department,
      location: form.location,
      status: form.status,
      managerId: form.managerId === NO_MANAGER ? undefined : form.managerId,
      joinDate: form.joinDate,
      phone: form.phone,
    }

    try {
      if (mode === "create") {
        await createEmployee.mutateAsync(input)
      } else {
        await updateEmployee.mutateAsync(input)
      }
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={triggerRender}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add employee" : "Edit employee"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Creates the employee record. Invite them separately to give them login access."
                : "Updates this employee's record."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-name">Full name</Label>
                <Input
                  id="emp-name"
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-title">Title</Label>
                <Input
                  id="emp-title"
                  required
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-department">Department</Label>
                <Select value={form.department} onValueChange={(v) => update("department", v as string)}>
                  <SelectTrigger id="emp-department" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-location">Location</Label>
                <Input
                  id="emp-location"
                  required
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-phone">Phone</Label>
                <Input
                  id="emp-phone"
                  required
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update("status", v as EmployeeStatus)}
                >
                  <SelectTrigger id="emp-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-join-date">Join date</Label>
                <Input
                  id="emp-join-date"
                  type="date"
                  required
                  value={form.joinDate}
                  onChange={(e) => update("joinDate", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-manager">Manager</Label>
              <Select value={form.managerId} onValueChange={(v) => update("managerId", v as string)}>
                <SelectTrigger id="emp-manager" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>No manager</SelectItem>
                  {managerOptions.data
                    ?.filter((e) => e.id !== employee?.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Add employee" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
