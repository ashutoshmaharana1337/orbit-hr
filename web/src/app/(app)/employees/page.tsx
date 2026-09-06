import { SiteHeader } from "@/components/layout/site-header"
import { EmployeeDirectory } from "./employee-directory"

export default function EmployeesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Employees" />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <EmployeeDirectory />
      </div>
    </div>
  )
}
