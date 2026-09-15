"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useDashboardStats } from "@/hooks/use-dashboard"
import { useDepartments } from "@/hooks/use-departments"

const chartConfig = {
  count: {
    label: "Employees",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function DepartmentChart() {
  const { data: stats, isLoading, isError } = useDashboardStats()
  const { data: departmentsResponse } = useDepartments()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
    )
  }
  if (isError || !stats) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive">
        Failed to load headcount.
      </div>
    )
  }

  const departmentNames = new Map(departmentsResponse?.items.map((d) => [d.id, d.name]) ?? [])
  const chartData = stats.headcountByDepartment.map((row) => ({
    department: (row.departmentId && departmentNames.get(row.departmentId)) ?? "Unassigned",
    count: row.count,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: -8, right: 16 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} className="text-xs" />
        <YAxis
          dataKey="department"
          type="category"
          tickLine={false}
          axisLine={false}
          width={80}
          className="text-xs"
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={20} />
      </BarChart>
    </ChartContainer>
  )
}
