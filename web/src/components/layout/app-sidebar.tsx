"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Network,
  ReceiptIndianRupee,
  Sparkles,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { PersonAvatar } from "@/components/person-avatar"
import { useAuth } from "@/lib/auth-context"
import { useDepartments } from "@/hooks/use-departments"
import { initials } from "@/lib/utils"

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Departments", url: "/departments", icon: Network },
  { title: "Attendance", url: "/attendance", icon: CalendarClock },
  { title: "Leave", url: "/leave", icon: CalendarDays },
]

const comingSoonNav = [
  { title: "Recruitment", icon: Briefcase },
  { title: "Payroll", icon: ReceiptIndianRupee },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, employee } = useAuth()
  const tenantName = user?.tenant?.name || "Orbit HR"
  const { data: departmentsResponse } = useDepartments()
  const departmentName = employee?.departmentId
    ? departmentsResponse?.items.find((d) => d.id === employee.departmentId)?.name
    : undefined
  const profileHref = departmentName ? `/d/${encodeURIComponent(departmentName.toLowerCase())}` : "/dashboard"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-base font-semibold tracking-tight">Orbit HR</span>
                <span className="truncate text-xs text-muted-foreground">{tenantName}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.url)}
                    tooltip={item.title}
                    render={<Link href={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Coming soon</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comingSoonNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton disabled tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>Soon</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={profileHref} />}>
              <PersonAvatar
                name={employee?.name ?? ""}
                initials={employee ? initials(employee.name) : ""}
                className="size-8"
                fallbackClassName="text-sm"
              />
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-medium">{employee?.name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{employee?.title ?? ""}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
