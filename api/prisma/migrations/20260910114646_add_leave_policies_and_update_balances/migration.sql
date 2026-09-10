-- Create LeavePolicy table
CREATE TABLE "LeavePolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "workingDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
  "publicHolidaysPerYear" INTEGER NOT NULL DEFAULT 0,
  "entitlementDays" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeavePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "LeavePolicy_tenantId_name_key" UNIQUE("tenantId", "name")
);

CREATE INDEX "LeavePolicy_tenantId_idx" ON "LeavePolicy"("tenantId");

-- Drop the old LeaveBalance and its constraints
DROP TABLE "LeaveBalance";

-- Create the new LeaveBalance table with proper structure
CREATE TABLE "LeaveBalance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leavePolicyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "entitledDays" DECIMAL(10,2) NOT NULL,
  "usedDays" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "balanceDays" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeaveBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE,
  CONSTRAINT "LeaveBalance_leavePolicyId_fkey" FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE,
  CONSTRAINT "LeaveBalance_tenantId_employeeId_leavePolicyId_year_key" UNIQUE("tenantId", "employeeId", "leavePolicyId", "year")
);

CREATE INDEX "LeaveBalance_tenantId_employeeId_idx" ON "LeaveBalance"("tenantId", "employeeId");
CREATE INDEX "LeaveBalance_tenantId_year_idx" ON "LeaveBalance"("tenantId", "year");

-- Enable RLS for LeavePolicy (tenant-scoped)
ALTER TABLE "LeavePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeavePolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeavePolicy"
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- Update LeaveBalance RLS to use tenantId directly instead of through Employee
ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeaveBalance"
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));
