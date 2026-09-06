"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Briefcase,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
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
import { initials } from "@/lib/mock-data"

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", url: "/employees", icon: Users },
  { title: "Attendance", url: "/attendance", icon: CalendarClock },
  { title: "Leave", url: "/leave", icon: CalendarDays },
]

const comingSoonNav = [
  { title: "Recruitment", icon: Briefcase },
  { title: "Payroll", icon: ReceiptIndianRupee },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { employee } = useAuth()
  const profileHref = employee ? `/d/${employee.department.toLowerCase()}` : "/dashboard"

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
                <span className="text-xs text-muted-foreground">Acme Inc.</span>
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
