import { cn } from "@/lib/utils"

export function StatusIndicator({
  color,
  label,
  className,
}: {
  color: string
  label: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
