"use client"

import Link from "next/link"
import { Bell, LogOut, Search, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/person-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"
import { useDepartments } from "@/hooks/use-departments"
import { initials } from "@/lib/utils"

export function SiteHeader({ title }: { title: string }) {
  const { user, employee, logout } = useAuth()
  const { data: departmentsResponse } = useDepartments()
  const departmentName = employee?.departmentId
    ? departmentsResponse?.items.find((d) => d.id === employee.departmentId)?.name
    : undefined
  const profileHref = departmentName ? `/d/${encodeURIComponent(departmentName.toLowerCase())}` : "/dashboard"

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Global search isn't wired up yet — keep the slot so the layout
            holds, but make it obvious the field isn't interactive. */}
        <div className="relative hidden sm:block" title="Search coming soon">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search coming soon"
            className="h-8 w-64 pl-8"
            disabled
            aria-disabled="true"
            aria-label="Search (coming soon)"
            readOnly
          />
        </div>

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 pl-1.5" />}>
            <PersonAvatar
              name={employee?.name ?? ""}
              initials={employee ? initials(employee.name) : ""}
              className="size-6"
              fallbackClassName="text-[10px]"
            />
            <span className="hidden text-sm font-medium sm:inline">{employee?.name ?? "—"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{employee?.name ?? "—"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email ?? ""}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={profileHref} />}>
              <UserRound />
              My profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
