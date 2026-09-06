import { cn } from "@/lib/utils"

export function Tag({
  color,
  children,
  className,
}: {
  color: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap text-foreground",
        className
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
      }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  )
}
