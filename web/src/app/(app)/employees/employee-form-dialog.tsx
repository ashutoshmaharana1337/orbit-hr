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
import { useDepartments } from "@/hooks/use-departments"
import { ApiError } from "@/lib/api-client"
import type { CreateEmployeeInput, EmployeeDetail, EmployeeStatus } from "@/lib/api/types"
import { useCreateEmployee, useEmployees, useUpdateEmployee } from "@/hooks/use-employees"

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  INACTIVE: "Inactive",
}

const NO_MANAGER = "none"
const NO_DEPARTMENT = "none"

type FormState = {
  name: string
  email: string
  title: string
  departmentId: string
  location: string
  status: EmployeeStatus
  managerId: string
  joinDate: string
  phone: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const FIELD_LABEL: Record<keyof FormState, string> = {
  name: "Full name",
  email: "Email",
  title: "Title",
  departmentId: "Department",
  location: "Location",
  status: "Status",
  managerId: "Manager",
  joinDate: "Join date",
  phone: "Phone",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}
  for (const key of ["name", "email", "title", "location", "phone", "joinDate"] as const) {
    if (!form[key].trim()) errors[key] = `${FIELD_LABEL[key]} is required.`
  }
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
    errors.email = "Enter a valid email address."
  }
  if (form.joinDate && Number.isNaN(new Date(form.joinDate).getTime())) {
    errors.joinDate = "Enter a valid date."
  }
  return errors
}

// class-validator messages start with the property name ("email must be an
// email"). Attach those to their field; anything else goes to the top.
function splitApiErrors(messages: string[]): { fields: FieldErrors; rest: string[] } {
  const fields: FieldErrors = {}
  const rest: string[] = []
  const keys = Object.keys(FIELD_LABEL) as (keyof FormState)[]
  for (const raw of messages) {
    const key = keys.find((k) => raw.startsWith(`${k} `) || raw === k)
    if (key) {
      const text = raw.replace(new RegExp(`^${key}\\b`), FIELD_LABEL[key])
      fields[key] = fields[key] ? `${fields[key]} ${text}.` : `${text}.`
    } else {
      rest.push(raw)
    }
  }
  return { fields, rest }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  )
}

function toFormState(employee?: EmployeeDetail): FormState {
  return {
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    title: employee?.title ?? "",
    departmentId: employee?.departmentId ?? NO_DEPARTMENT,
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
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})

  const managerOptions = useEmployees()
  const { data: departmentsResponse } = useDepartments()
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee(employee?.id ?? "")
  const pending = createEmployee.isPending || updateEmployee.isPending

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setForm(toFormState(employee))
      setError(null)
      setFieldErrors({})
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear the field's message as soon as the user starts fixing it.
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function fieldProps(key: keyof FormState) {
    const invalid = Boolean(fieldErrors[key])
    return {
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `emp-${key}-error` : undefined,
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const clientErrors = validate(form)
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    const input: CreateEmployeeInput = {
      name: form.name,
      email: form.email,
      title: form.title,
      departmentId: form.departmentId === NO_DEPARTMENT ? undefined : form.departmentId,
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
      if (err instanceof ApiError && err.status === 400) {
        const { fields, rest } = splitApiErrors(err.messages)
        setFieldErrors(fields)
        setError(rest.length ? rest.join(", ") : null)
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.")
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={triggerRender}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* noValidate: we render our own inline messages instead of the
            browser's native tooltips, which don't suit the dialog. */}
        <form onSubmit={onSubmit} noValidate>
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
                  {...fieldProps("name")}
                />
                <FieldError id="emp-name-error" message={fieldErrors.name} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  {...fieldProps("email")}
                />
                <FieldError id="emp-email-error" message={fieldErrors.email} />
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
                  {...fieldProps("title")}
                />
                <FieldError id="emp-title-error" message={fieldErrors.title} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-department">Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => update("departmentId", v as string)}>
                  <SelectTrigger id="emp-department" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                    {(departmentsResponse?.items ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
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
                  {...fieldProps("location")}
                />
                <FieldError id="emp-location-error" message={fieldErrors.location} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emp-phone">Phone</Label>
                <Input
                  id="emp-phone"
                  required
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  {...fieldProps("phone")}
                />
                <FieldError id="emp-phone-error" message={fieldErrors.phone} />
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
                  {...fieldProps("joinDate")}
                />
                <FieldError id="emp-joinDate-error" message={fieldErrors.joinDate} />
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
                  {managerOptions.data?.items
                    ?.filter((e) => e.id !== employee?.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {(fieldErrors.departmentId || fieldErrors.managerId || fieldErrors.status) && (
              <FieldError
                id="emp-select-error"
                message={[fieldErrors.departmentId, fieldErrors.managerId, fieldErrors.status]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
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
