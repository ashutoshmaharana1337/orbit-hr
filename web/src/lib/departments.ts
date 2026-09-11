// The six known department names. `Employee.department` is free-text on the
// schema (see api/prisma/schema.prisma) — there's no Department table yet —
// but every path that creates or edits an employee constrains the value to
// this list via a <Select>, so in practice every real employee's department
// is one of these. Used for dropdowns and the department landing page.
export const departments = [
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "People",
  "Finance",
] as const

export type DepartmentName = (typeof departments)[number]
