-- Add deletedAt column to Employee table
ALTER TABLE "Employee" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create index on (tenantId, deletedAt) for efficient soft delete queries
CREATE INDEX "Employee_tenantId_deletedAt_idx" ON "Employee"("tenantId", "deletedAt");
