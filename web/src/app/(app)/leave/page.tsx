import { SiteHeader } from "@/components/layout/site-header"
import { LeaveBoard } from "./leave-board"

export default function LeavePage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Leave" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <LeaveBoard />
      </div>
    </div>
  )
}
