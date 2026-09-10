"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useDashboardStats } from "@/hooks/use-dashboard"

const chartConfig = {
  count: {
    label: "Employees",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function DepartmentChart() {
  const { data: stats, isLoading, isError } = useDashboardStats()

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

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart
        data={stats.headcountByDepartment}
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
