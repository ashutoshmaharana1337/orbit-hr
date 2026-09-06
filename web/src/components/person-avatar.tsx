import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { avatarFill } from "@/lib/colors"
import { cn } from "@/lib/utils"

export function PersonAvatar({
  name,
  initials,
  className,
  fallbackClassName,
}: {
  name: string
  initials: string
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={className}>
      <AvatarFallback
        className={cn("font-medium text-white", fallbackClassName)}
        style={{ backgroundColor: avatarFill(name) }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
