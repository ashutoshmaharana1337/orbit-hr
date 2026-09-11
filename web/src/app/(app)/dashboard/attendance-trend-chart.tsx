"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useAttendanceTrend } from "@/hooks/use-attendance"

const chartConfig = {
  present: {
    label: "Present",
    color: "var(--chart-1)",
  },
  onLeave: {
    label: "On leave",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function AttendanceTrendChart() {
  const { data, isLoading, isError } = useAttendanceTrend(7)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
    )
  }
  if (isError || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive">
        Failed to load attendance trend.
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs"
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={28} className="text-xs" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="present"
          type="monotone"
          stroke="var(--color-present)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-present)", strokeWidth: 2, stroke: "var(--card)" }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
        />
        <Line
          dataKey="onLeave"
          type="monotone"
          stroke="var(--color-onLeave)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-onLeave)", strokeWidth: 2, stroke: "var(--card)" }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </LineChart>
    </ChartContainer>
  )
}
