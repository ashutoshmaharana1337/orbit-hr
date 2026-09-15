"use client"

import { useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tag } from "@/components/tag"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { departmentColor } from "@/lib/colors"
import { ApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import type { Department } from "@/lib/api/types"
import { useDepartments, useDeleteDepartment } from "@/hooks/use-departments"
import { DepartmentFormDialog } from "./department-form-dialog"

function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
}: {
  department: Department
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const deleteDepartment = useDeleteDepartment()
  const [error, setError] = useState<string | null>(null)
  const count = department._count?.employees ?? 0

  async function onConfirm() {
    setError(null)
    try {
      await deleteDepartment.mutateAsync(department.id)
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't delete this department. Try again."
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!deleteDepartment.isPending) {
          setError(null)
          onOpenChange(next)
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {department.name}?</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `${count} employee${count === 1 ? " is" : "s are"} still assigned to this department. Reassign them first — deleting will be rejected until then.`
              : "This can't be undone."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={deleteDepartment.isPending} />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteDepartment.isPending}
            onClick={onConfirm}
          >
            {deleteDepartment.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DepartmentRowActions({ department }: { department: Department }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="flex justify-end gap-1.5">
      {/* Plain Button: DialogTrigger's `render` prop clones its open/aria
          props directly onto this element, so it can't be a Tooltip tree
          (that's what broke the click handling — see delete's button below
          for the pattern that composes with Tooltip, a plain onClick into
          separately-controlled dialog state). aria-label alone still gives
          it an accessible name. */}
      <DepartmentFormDialog
        mode="edit"
        department={department}
        triggerRender={<Button size="icon-sm" variant="outline" aria-label="Edit department" />}
      >
        <Pencil />
      </DepartmentFormDialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Delete department"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleting(true)}
            />
          }
        >
          <Trash2 />
        </TooltipTrigger>
        <TooltipContent>Delete department</TooltipContent>
      </Tooltip>
      <DeleteDepartmentDialog department={department} open={deleting} onOpenChange={setDeleting} />
    </div>
  )
}

export function DepartmentDirectory() {
  const [query, setQuery] = useState("")
  const role = useAuth().user?.role
  const canManage = role === "ADMIN" || role === "HR"

  const { data: response, isLoading, isError, error } = useDepartments()
  const filtered = useMemo(() => {
    const items = response?.items ?? []
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (d) => d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
    )
  }, [response?.items, query])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search departments..."
          className="h-8 w-64"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `${filtered.length} department${filtered.length === 1 ? "" : "s"}`}
        </span>
        {canManage && (
          <DepartmentFormDialog mode="create" triggerRender={<Button size="sm" className="ml-auto" />}>
            <Plus />
            Add department
          </DepartmentFormDialog>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Employees</TableHead>
              {canManage && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                  {canManage && <TableCell />}
                </TableRow>
              ))}
            {isError && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="py-8 text-center text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load departments."}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              filtered.map((department) => (
                <TableRow key={department.id}>
                  <TableCell>
                    <Tag color={departmentColor(department.name)}>{department.name}</Tag>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {department.description || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {department._count?.employees ?? 0}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <DepartmentRowActions department={department} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            {!isLoading && !isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="py-8 text-center text-sm text-muted-foreground">
                  No departments match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
