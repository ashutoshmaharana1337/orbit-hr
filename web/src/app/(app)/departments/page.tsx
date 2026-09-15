import { SiteHeader } from "@/components/layout/site-header"
import { DepartmentDirectory } from "./department-directory"

export default function DepartmentsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Departments" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <DepartmentDirectory />
      </div>
    </div>
  )
}
