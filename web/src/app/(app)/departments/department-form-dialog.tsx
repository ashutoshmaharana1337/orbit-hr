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
import { ApiError } from "@/lib/api-client"
import type { Department } from "@/lib/api/types"
import { useCreateDepartment, useUpdateDepartment } from "@/hooks/use-departments"

type FormState = {
  name: string
  description: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const FIELD_LABEL: Record<keyof FormState, string> = {
  name: "Name",
  description: "Description",
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}
  const name = form.name.trim()
  if (!name) errors.name = "Name is required."
  else if (name.length < 2) errors.name = "Name must be at least 2 characters."
  else if (name.length > 100) errors.name = "Name must be 100 characters or fewer."
  if (form.description.trim().length > 500) {
    errors.description = "Description must be 500 characters or fewer."
  }
  return errors
}

// class-validator messages start with the property name ("name must be
// longer than or equal to 2 characters"). Attach those to their field;
// anything else (e.g. the duplicate-name 409) goes to the top.
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

function toFormState(department?: Department): FormState {
  return {
    name: department?.name ?? "",
    description: department?.description ?? "",
  }
}

type DepartmentFormDialogProps = {
  mode: "create" | "edit"
  department?: Department
  /** Element the DialogTrigger renders as, e.g. `<Button size="sm" />` */
  triggerRender: React.ReactElement
  /** Visible content of the trigger, e.g. `<><Plus /> Add department</>` */
  children: React.ReactNode
}

export function DepartmentFormDialog({
  mode,
  department,
  triggerRender,
  children,
}: DepartmentFormDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(() => toFormState(department))
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})

  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment(department?.id ?? "")
  const pending = createDepartment.isPending || updateDepartment.isPending

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setForm(toFormState(department))
      setError(null)
      setFieldErrors({})
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function fieldProps(key: keyof FormState) {
    const invalid = Boolean(fieldErrors[key])
    return {
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `dept-${key}-error` : undefined,
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const clientErrors = validate(form)
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    const input = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
    }

    try {
      if (mode === "create") {
        await createDepartment.mutateAsync(input)
      } else {
        await updateDepartment.mutateAsync(input)
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
            <DialogTitle>{mode === "create" ? "Add department" : "Edit department"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Creates a department employees can be assigned to."
                : "Updates this department's name and description."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                {...fieldProps("name")}
              />
              <FieldError id="dept-name-error" message={fieldErrors.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-description">Description</Label>
              <Input
                id="dept-description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                {...fieldProps("description")}
              />
              <FieldError id="dept-description-error" message={fieldErrors.description} />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Add department" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
