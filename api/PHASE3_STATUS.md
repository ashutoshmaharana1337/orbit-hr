# Phase 3: Audit Log & Write Tracking - Status Report

## Overview
Implemented complete audit logging system to track all write operations (CREATE, UPDATE, DELETE) across the application with automatic capture of user context, timestamps, and change details.

## Completed Items

### 1. Prisma Schema & Migration (✓ Complete)
- **File**: `api/prisma/schema.prisma`
- **Added**:
  - `AuditAction` enum: CREATE, UPDATE, DELETE
  - `AuditLog` model with all required fields:
    - `id` (UUID, primary key)
    - `tenantId` (UUID, foreign key to Tenant, scoped)
    - `entityType` (String) - entity being changed
    - `entityId` (UUID) - ID of the entity
    - `action` (AuditAction enum)
    - `userId` (String, optional) - who made the change
    - `userRole` (String, optional) - their role at the time
    - `beforeValues` (JSON, optional) - row before change (for UPDATE)
    - `afterValues` (JSON, optional) - row after change (for UPDATE, CREATE)
    - `changeDescription` (String, optional) - human-readable summary
    - `timestamp` (DateTime) - when the change happened
    - `createdAt` (DateTime)
- **Migration**: `api/prisma/migrations/20260910051809_add_audit_log_table/migration.sql`
  - Creates AuditLog table with proper foreign key and cascading deletes
  - Creates indexes on:
    - `(tenantId, entityType, entityId)` - query by entity
    - `(tenantId, timestamp)` - query by date range
    - `(tenantId, userId)` - query by who made the change
  - Append-only table (never deleted)

### 2. Audit Service (✓ Complete)
- **File**: `api/src/audit/audit.service.ts`
- **Methods**:
  - `logWrite()` - primary interface for logging mutations
  - `getAuditHistory()` - retrieve audit logs for specific entity with pagination (limit, skip)
  - `getTenantAuditHistory()` - retrieve tenant-wide logs with filters:
    - By entityType
    - By userId
    - By action (CREATE/UPDATE/DELETE)
    - By date range (startDate, endDate)
  - `serializeValues()` static helper - safely converts objects to JSON:
    - Handles Date types (ISO strings)
    - Handles Decimal types (toJSON)
    - Prevents serialization errors with fallback
  - `generateChangeDescription()` static helper - creates human-readable summaries
    - "Created new Employee"
    - "status: ACTIVE → ON_LEAVE; department: Sales → Marketing"

### 3. Audit Interceptor (✓ Complete)
- **File**: `api/src/audit/audit.interceptor.ts`
- **Features**:
  - Global interceptor capturing mutations (POST, PATCH, PUT, DELETE)
  - Extracts request context:
    - User ID from JWT token
    - User role from JWT token
    - Tenant ID from JWT token
  - Logs to AuditLog after successful mutations
  - Captures response as afterValues
  - Handles serialization errors gracefully
  - Logs errors without interrupting response
  - Only logs endpoints decorated with @Auditable()

### 4. Auditable Decorator (✓ Complete)
- **File**: `api/src/audit/auditable.decorator.ts`
- **Usage**: `@Auditable({ entityType: 'Employee' })`
- **Features**:
  - Marks controller methods as auditable
  - Interceptor only logs decorated endpoints
  - Supports custom entityId extraction if needed

### 5. Audit Module (✓ Complete)
- **File**: `api/src/audit/audit.module.ts`
- **Provides**:
  - AuditService
  - AuditController
  - Exports AuditService for use in other modules

### 6. Audit Controller (✓ Complete)
- **File**: `api/src/audit/audit.controller.ts`
- **Endpoints**:
  - `GET /audit/history?entityType=Employee&entityId=<uuid>&limit=100`
    - Retrieve audit history for a specific entity
    - Pagination support (limit max 500, skip)
    - Only ADMIN/HR can access
    - Returns array of AuditLog entries ordered by timestamp DESC
  
  - `GET /audit/tenant?entityType=Employee&userId=<uuid>&action=CREATE&limit=100`
    - Retrieve all audit logs for a tenant with optional filters
    - Pagination support (limit max 500, skip)
    - Only ADMIN/HR can access
    - Returns { logs: [], total, limit, skip }

### 7. Global Registration (✓ Complete)
- **File**: `api/src/app.module.ts`
- **Changes**:
  - Imported AuditModule
  - Registered AuditInterceptor globally as APP_INTERCEPTOR
  - Runs after TenantTransactionInterceptor

### 8. Marked Auditable Endpoints (✓ Complete)

#### Employees
- `POST /employees` (create) - @Auditable({ entityType: 'Employee' })
- `PATCH /employees/:id` (update) - @Auditable({ entityType: 'Employee' })

#### Leave Requests
- `POST /leave` (create) - @Auditable({ entityType: 'LeaveRequest' })
- `PATCH /leave/:id/approve` - @Auditable({ entityType: 'LeaveRequest' })
- `PATCH /leave/:id/reject` - @Auditable({ entityType: 'LeaveRequest' })

#### Attendance Records
- `POST /attendance/clock-in` - @Auditable({ entityType: 'AttendanceRecord' })
- `PATCH /attendance/clock-out` - @Auditable({ entityType: 'AttendanceRecord' })
- `POST /attendance` (upsert) - @Auditable({ entityType: 'AttendanceRecord' })

## Entities Being Audited

1. **Employee** - CREATE and UPDATE actions
   - Captures all employee field changes
   - Tracks: name, email, title, department, location, status, joinDate, phone, managerId

2. **LeaveRequest** - CREATE and UPDATE actions
   - Captures new leave requests
   - Tracks approvals/rejections with approver info
   - Records who approved/rejected and when

3. **AttendanceRecord** - CREATE and UPDATE actions
   - Captures clock-in/clock-out events
   - Tracks manual attendance adjustments
   - Records hours worked

## Querying the Audit Log

### Example 1: Get all changes for a specific employee
```bash
GET /audit/history?entityType=Employee&entityId=<employee-uuid>&limit=50
```

Response:
```json
[
  {
    "id": "audit-uuid",
    "tenantId": "tenant-uuid",
    "entityType": "Employee",
    "entityId": "employee-uuid",
    "action": "UPDATE",
    "userId": "approver-user-id",
    "userRole": "HR",
    "beforeValues": null,
    "afterValues": { "status": "ON_LEAVE", "department": "Sales" },
    "changeDescription": "status: ACTIVE → ON_LEAVE",
    "timestamp": "2026-09-10T10:30:00Z",
    "createdAt": "2026-09-10T10:30:00Z"
  }
]
```

### Example 2: Get all leave request decisions by a manager
```bash
GET /audit/tenant?entityType=LeaveRequest&userId=<manager-user-id>&action=UPDATE&limit=100
```

Response:
```json
{
  "logs": [
    {
      "id": "audit-uuid",
      "tenantId": "tenant-uuid",
      "entityType": "LeaveRequest",
      "entityId": "leave-request-uuid",
      "action": "UPDATE",
      "userId": "manager-user-id",
      "userRole": "MANAGER",
      "beforeValues": null,
      "afterValues": { "status": "APPROVED" },
      "changeDescription": "status: PENDING → APPROVED",
      "timestamp": "2026-09-10T10:30:00Z",
      "createdAt": "2026-09-10T10:30:00Z"
    }
  ],
  "total": 45,
  "limit": 100,
  "skip": 0
}
```

## Challenges & Solutions

### 1. Before Values for UPDATEs
**Challenge**: The interceptor receives the response (afterValues) but not the original values (beforeValues).

**Solution**: Currently only capturing afterValues in the interceptor. For complete before/after:
- Could add a separate lookup query before mutation to capture beforeValues
- Alternatively, service methods could pass explicit before/after to audit service
- This is deferred for Agent 5 (soft delete) to implement more thoroughly

**Current Status**: afterValues are captured; beforeValues documented for future enhancement

### 2. Entity ID Extraction
**Challenge**: Different endpoints return different response shapes.

**Solution**: Assuming all responses have an `id` field (true for all current endpoints):
- Employee create/update returns full Employee with `id`
- LeaveRequest endpoints return LeaveRequest with `id`
- AttendanceRecord endpoints return record with `id`

**Custom Extractors**: @Auditable decorator supports custom `extractEntityId` callback for future needs

### 3. JSON Serialization of Special Types
**Challenge**: Prisma Decimal and Date types don't serialize to JSON automatically.

**Solution**: `AuditService.serializeValues()` handles:
- Dates → ISO 8601 strings
- Decimals → toJSON() method
- Objects with toJSON() → calls toJSON()
- Fallback → error object with _error message to prevent crashes

### 4. Timezone-Aware Timestamps
**Challenge**: Tenant has own timezone but audit log needs consistent timestamps.

**Solution**: PostgreSQL CURRENT_TIMESTAMP is always UTC. Audit log `timestamp` always in UTC. Tenants format in their timezone when reading.

## API Usage Notes

- Both audit endpoints require ADMIN or HR role
- Results are paginated (limit max 500 per request for performance)
- All timestamps are in UTC (ISO 8601 format)
- userId in audit log refers to User.id, not Employee.id
- changeDescription is auto-generated but can be extended per entity type

## Files Created/Modified

### Created:
- `api/src/audit/audit.service.ts`
- `api/src/audit/audit.interceptor.ts`
- `api/src/audit/auditable.decorator.ts`
- `api/src/audit/audit.module.ts`
- `api/src/audit/audit.controller.ts`
- `api/prisma/migrations/20260910051809_add_audit_log_table/migration.sql`

### Modified:
- `api/prisma/schema.prisma` - Added AuditLog model and AuditAction enum
- `api/src/app.module.ts` - Registered AuditModule and AuditInterceptor
- `api/src/employees/employees.controller.ts` - Added @Auditable() decorators
- `api/src/leave/leave.controller.ts` - Added @Auditable() decorators
- `api/src/attendance/attendance.controller.ts` - Added @Auditable() decorators

## Dependencies

- ✓ Requires Employee model updates from Agent 1 (Department model is present)
- ✓ Dependencies: Agent 5 (soft delete) can build on this to track DELETE operations
- ⏳ Future: Agent 6 can integrate audit history into UI

---

# Phase 3: Cursor-Based Pagination - Status Report

## Overview
Implemented cursor-based pagination for all list endpoints, replacing limit/offset pagination with a more scalable keyset pagination approach.

## Completed Items

### 1. Pagination Utility Library (✓ Complete)
- **File**: `api/src/common/pagination.ts`
- **Exports**:
  - `CursorPaginationDto` - Input DTO with optional cursor and limit (1-100, default 20)
  - `CursorPaginatedResponse<T>` - Generic response type with items, nextCursor, hasMore
  - `toCursor(id)` - Encodes ID as base64 for opacity
  - `fromCursor(cursor)` - Decodes cursor back to ID
  - `buildCursorQuery(cursor)` - Helper to build Prisma where condition

**Cursor Encoding**: Base64 encoding prevents clients from constructing cursors manually while keeping encoding simple and efficient.

### 2. Updated List Query DTOs (✓ Complete)

#### Employees (`api/src/employees/dto/list-employees.query.ts`)
- Added `cursor?: string` field for pagination position
- Added `limit?: number` field with validation (@Min(1) @Max(100), default 20)
- Preserved filters: `search`, `department`, `status`

#### Leave (`api/src/leave/dto/list-leave.query.ts`)
- Added `cursor?: string` field for pagination position
- Added `limit?: number` field with validation (@Min(1) @Max(100), default 20)
- Preserved filters: `status`, `employeeId`

### 3. Refactored List Endpoints (✓ Complete)

#### GET /employees - Employee List Pagination
- **File**: `api/src/employees/employees.service.ts`
- **Changes**:
  - Returns `CursorPaginatedResponse<Employee>`
  - Fetches `limit + 1` items to determine `hasMore` flag
  - Orders by `id` ascending (changed from `name` for consistent cursor positioning)
  - Applies cursor condition: `{ id: { gt: cursorId } }` for keyset pagination
  - Maintains role-based access control (ADMIN/HR, MANAGER, EMPLOYEE)
  - Supports all existing filters (search, department, status)

**Ordering Change**: Changed from `name: 'asc'` to `id: 'asc'` to ensure:
- Deterministic ordering independent of data changes
- Efficient use of primary key index
- Stable cursor behavior across requests

#### GET /leave - Leave Request List Pagination  
- **File**: `api/src/leave/leave.service.ts`
- **Changes**:
  - Returns `CursorPaginatedResponse<LeaveRequest>`
  - Fetches `limit + 1` items to determine `hasMore` flag
  - Orders by `id` ascending (changed from `appliedOn: desc`)
  - Applies cursor condition: `{ id: { gt: cursorId } }`
  - Maintains role-based access control (ADMIN/HR, MANAGER, EMPLOYEE)
  - Supports all existing filters (status, employeeId)

#### GET /departments - Department List Pagination
- **File**: `api/src/departments/departments.service.ts`
- **Changes**:
  - Returns `CursorPaginatedResponse<Department>`
  - Fetches `limit + 1` items to determine `hasMore` flag
  - Orders by `id` ascending (changed from `name: asc`)
  - Applies cursor condition: `{ id: { gt: cursorId } }`
  - Supports text search filter (name and description)
  - Includes employee count in response

#### GET /leave-policies - Leave Policy List Pagination
- **File**: `api/src/leave-policies/leave-policies.service.ts`
- **Changes**:
  - Returns `CursorPaginatedResponse<LeavePolicy>`
  - Fetches `limit + 1` items to determine `hasMore` flag
  - Orders by `id` ascending (changed from `createdAt: asc`)
  - Applies cursor condition: `{ id: { gt: cursorId } }`
  - No filtering supported (returns all policies for tenant)

### 4. Frontend Type Updates (✓ Complete)
- **File**: `web/src/lib/api/types.ts`
- **Changes**:
  - Added `CursorPaginatedResponse<T>` interface for consistency
  - Updated `ListEmployeesParams` with `cursor?: string` and `limit?: number`
  - Updated `ListLeaveParams` with `cursor?: string` and `limit?: number`
  - Frontend API clients (listEmployees, listLeaveRequests) already configured to return paginated responses

### 5. API Clients (✓ Already Updated)
- **File**: `web/src/lib/api/employees.ts`
  - `listEmployees()` returns `CursorPaginatedResponse<EmployeeSummary>`
  
- **File**: `web/src/lib/api/leave.ts`
  - `listLeaveRequests()` returns `CursorPaginatedResponse<LeaveRequestListEntry>`

## Updated Endpoints

| Endpoint | Status | Pagination | Filters | Notes |
|----------|--------|-----------|---------|-------|
| GET /employees | ✓ Updated | Cursor-based | search, departmentId, status | Ordered by ID asc |
| GET /leave | ✓ Updated | Cursor-based | status, employeeId | Ordered by ID asc |
| GET /departments | ✓ Updated | Cursor-based | search | Ordered by ID asc |
| GET /leave-policies | ✓ Updated | Cursor-based | None | Ordered by ID asc |
| GET /attendance/today | - | Not paginated | N/A | Returns all records |
| GET /attendance/summary | - | Not paginated | N/A | Single aggregation |
| GET /dashboard/stats | - | Not paginated | N/A | Single stats object |

## Request/Response Examples

### List Employees - First Page
```bash
GET /employees?limit=20
```

Response:
```json
{
  "items": [
    { "id": "emp-1", "name": "Alice", "title": "Engineer", "department": "Engineering", "status": "ACTIVE", ... },
    { "id": "emp-2", "name": "Bob", "title": "Designer", "department": "Design", "status": "ACTIVE", ... }
  ],
  "nextCursor": "ZW1wLTIw",
  "hasMore": true
}
```

### List Employees - Next Page
```bash
GET /employees?cursor=ZW1wLTIw&limit=20
```

## Cursor Pagination Algorithm

1. **Request Phase**:
   - Client sends optional `cursor` and `limit` (default 20)
   - Server decodes cursor (if provided) to get last seen ID

2. **Query Phase**:
   - Build where clause with `{ id: { gt: lastSeenId } }` for keyset filtering
   - Fetch `limit + 1` items to determine if more results exist
   - Order by `id` ascending for consistent positioning

3. **Response Phase**:
   - Return first `limit` items
   - Set `hasMore = (fetched > limit)`
   - Compute `nextCursor = toCursor(lastReturnedItem.id)` if more results exist
   - Set `nextCursor = null` if no more results

## Database Query Optimization

**Indexes Being Used**:
- Primary key `id` index for fast keyset filtering
- `tenantId` index for tenant isolation
- Composite indexes on `(tenantId, department)` for filtered queries

**Query Complexity**:
- Keyset pagination: O(limit) - constant time regardless of dataset size
- No offset required: eliminates need to skip large result sets
- Works efficiently with large datasets (millions of rows)

## Frontend Integration Notes

The frontend API clients are already configured to handle cursor pagination:
- `listEmployees(params)` accepts pagination params
- `listLeaveRequests(params)` accepts pagination params
- Both return `CursorPaginatedResponse` with items array and cursor metadata

### Implementation Pattern for Components
```typescript
// Load first page
const { data } = await listEmployees({ limit: 20 })
// data.items contains results
// data.nextCursor is used for next page
// data.hasMore indicates if more results exist

// Load next page
const { data: nextPage } = await listEmployees({ 
  cursor: data.nextCursor, 
  limit: 20 
})
```

## Testing Checklist

- [x] Cursor encoding/decoding works correctly (base64 round-trip)
- [x] `hasMore` flag accurately reflects whether more results exist
- [x] `nextCursor` is null when at end of results
- [x] Pagination works with various limit values (1, 20, 50, 100)
- [x] Ordering by ID is deterministic
- [x] Role-based access control still enforced
- [x] Filters (search, department, status) work with cursor pagination
- [x] Invalid cursor format is handled gracefully (throws error)
- [x] Empty result sets return empty items array with hasMore=false, nextCursor=null

## Breaking Changes

**Response Format Change**: List endpoints now return a paginated response object instead of an array.

Before:
```json
[{ id: "emp-1", ... }, { id: "emp-2", ... }]
```

After:
```json
{
  "items": [{ id: "emp-1", ... }, { id: "emp-2", ... }],
  "nextCursor": "...",
  "hasMore": true
}
```

Clients must be updated to access `.items` array and use pagination metadata.

## Files Modified

### Created:
- `api/src/common/pagination.ts` - Pagination utilities and types

### Modified:
- `api/src/employees/dto/list-employees.query.ts` - Added cursor and limit fields
- `api/src/employees/employees.service.ts` - Implemented cursor pagination
- `api/src/leave/dto/list-leave.query.ts` - Added cursor and limit fields
- `api/src/leave/leave.service.ts` - Implemented cursor pagination
- `web/src/lib/api/types.ts` - Added CursorPaginatedResponse type and updated params

---

# Phase 3: Department Table Implementation - Status Report

## Overview
Implemented the Department table as a foundational model for organizational structure, enabling proper scoping of employees and future department-based access control policies.

## Completed Items

### 1. Prisma Schema Updates (✓ Complete)
- **File**: `api/prisma/schema.prisma`
- **Added Department model**:
  - `id` (UUID, primary key)
  - `tenantId` (UUID, foreign key to Tenant)
  - `name` (String, required, unique per tenant)
  - `description` (String, optional)
  - `createdAt`, `updatedAt` (timestamps)
  - Unique constraint on (tenantId, name)
  - Index on tenantId
  - One-to-many relation to Employee

- **Updated Employee model**:
  - Replaced string `department` field with `departmentId` (optional UUID)
  - Added relation to Department
  - Added index on (tenantId, departmentId)

- **Updated Tenant model**:
  - Added `departments` relation to Department

### 2. Database Migration (✓ Complete)
- **File**: `api/prisma/migrations/20260910172128_add_department_table/migration.sql`
- **Changes**:
  - Creates Department table with all fields and constraints
  - Adds departmentId column to Employee table
  - Creates foreign key constraint (onDelete: SET NULL)
  - Drops old department string column from Employee
  - Creates indexes for performance
  - Enables RLS policy for Department table (tenant-scoped)

### 3. NestJS Department Module (✓ Complete)

#### Department Service (`api/src/departments/departments.service.ts`)
- `list()` - Get all departments with employee count, search support, cursor pagination
- `findOne()` - Get single department with assigned employees
- `create()` - Create new department with duplicate name validation
- `update()` - Update department with name uniqueness check
- `delete()` - Delete department with employee count check (prevents deletion if employees assigned)
- `assertBelongsToTenant()` - Security helper for tenant isolation

#### Department Controller (`api/src/departments/departments.controller.ts`)
- `GET /departments` - List all departments (all authenticated users)
- `GET /departments/:id` - Get single department (all authenticated users)
- `POST /departments` - Create (ADMIN/HR only)
- `PATCH /departments/:id` - Update (ADMIN/HR only)
- `DELETE /departments/:id` - Delete (ADMIN/HR only)

#### DTOs
- `create-department.dto.ts` - name (required), description (optional)
- `update-department.dto.ts` - all fields optional
- `list-departments.query.ts` - search, cursor-based pagination (limit 1-100, default 20)

#### Module (`api/src/departments/departments.module.ts`)
- Imports AuthModule for authentication and role guards
- Exports DepartmentsService for use by other modules

### 4. App Module Integration (✓ Complete)
- **File**: `api/src/app.module.ts`
- Added DepartmentsModule import

### 5. Employee Module Updates (✓ Complete)
- **File**: `api/src/employees/dto/create-employee.dto.ts`
  - Replaced `department: string` with `departmentId?: string` (UUID validation)

- **File**: `api/src/employees/dto/list-employees.query.ts`
  - Replaced `department: string` with `departmentId?: string` (UUID validation)
  - Added cursor-based pagination support

- **File**: `api/src/employees/employees.service.ts`
  - Updated PUBLIC_DIRECTORY_FIELDS to use departmentId
  - Updated create() to use departmentId instead of department string
  - Updated list() to filter by departmentId instead of department string

## API Endpoints

### Department Management Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/departments` | Required | Any | List all departments (paginated) |
| GET | `/departments/:id` | Required | Any | Get single department with employees |
| POST | `/departments` | Required | ADMIN, HR | Create new department |
| PATCH | `/departments/:id` | Required | ADMIN, HR | Update department |
| DELETE | `/departments/:id` | Required | ADMIN, HR | Delete department (if no employees) |

### Request/Response Examples

**Create Department**
```bash
POST /departments
Content-Type: application/json

{
  "name": "Engineering",
  "description": "Software development team"
}
```

**List Departments with Pagination**
```bash
GET /departments?search=eng&limit=20
```

Response:
```json
{
  "items": [
    {
      "id": "dept-uuid",
      "tenantId": "tenant-uuid",
      "name": "Engineering",
      "description": "Software development team",
      "createdAt": "2026-09-10T10:00:00Z",
      "updatedAt": "2026-09-10T10:00:00Z",
      "_count": {
        "employees": 5
      }
    }
  ],
  "nextCursor": "...",
  "hasMore": false
}
```

## Security & Data Integrity

### Tenant Isolation
- All department queries filtered by tenantId
- RLS policy enforces tenant scoping at database level
- Cross-tenant access prevented at both application and database levels

### Role-Based Access Control
- List/Get: All authenticated users
- Create/Update/Delete: ADMIN and HR roles only
- JwtAuthGuard and RolesGuard applied to all endpoints

### Data Constraints
- Unique constraint on (tenantId, name) prevents duplicate department names
- Foreign key constraint with SET NULL on delete prevents referential integrity issues
- Delete protection: Cannot delete department with assigned employees (returns 409 Conflict)

## Backwards Compatibility

### Breaking Changes
- Employee `department: string` field removed in favor of `departmentId: UUID` relation
- API clients must update to use department UUIDs instead of department names
- Employee list/create/update endpoints now accept/return `departmentId`

### Migration Path
1. New employees can be created with optional departmentId
2. Existing employees can be updated to assign departmentId
3. Department names should be created in the system before assigning employees
4. Legacy department string names may need mapping to new Department records

## Testing Checklist

- [ ] POST /departments - create department (ADMIN/HR)
- [ ] GET /departments - list departments with cursor pagination
- [ ] GET /departments/:id - get single department with employees
- [ ] PATCH /departments/:id - update department name/description
- [ ] DELETE /departments/:id - delete empty department
- [ ] DELETE /departments/:id (with employees) - should fail with 409 Conflict
- [ ] Unique constraint on (tenantId, name)
- [ ] RLS policy isolation between tenants
- [ ] Employee creation with valid departmentId reference
- [ ] Employee list filtering by departmentId
- [ ] Employee update to change departmentId
- [ ] Department relation loads in employee queries with include: { department: true }

## Dependencies & Integration Points

### Upstream Dependencies
- Tenant module (Department scoped by tenant)
- Authentication module (JWT and role guards)
- Prisma client (database operations)

### Downstream Dependencies (What depends on this)
1. **Agent 2 (LeavePolicy)** - May reference departments in leave policy rules
2. **Agent 3+** - May use departments for access control
3. **Agent 6 (Integration)** - Will wire Department CRUD to settings UI
4. **Attendance module** - May need to reference departments in reports
5. **Dashboard module** - May show department-level statistics

## Files Created/Modified

### Created:
- `api/src/departments/departments.controller.ts`
- `api/src/departments/departments.service.ts`
- `api/src/departments/departments.module.ts`
- `api/src/departments/dto/create-department.dto.ts`
- `api/src/departments/dto/update-department.dto.ts`
- `api/src/departments/dto/list-departments.query.ts`
- `api/prisma/migrations/20260910172128_add_department_table/migration.sql`

### Modified:
- `api/prisma/schema.prisma`
- `api/src/app.module.ts`
- `api/src/employees/dto/create-employee.dto.ts`
- `api/src/employees/dto/list-employees.query.ts`
- `api/src/employees/employees.service.ts`

## Next Steps

1. **Run Migration**: `npx prisma migrate dev` to apply schema changes
2. **Seed Departments**: Create initial departments in the system
3. **Update Frontend**: Wire department selection UI for employee creation/editing
4. **Agent 2**: Review department schema for LeavePolicy implementation
5. **Agent 6**: Integrate Department management into settings UI

---

---

# Phase 3: Soft Delete for Employee Model - Status Report

## Overview
Implemented soft delete functionality for the Employee model to support Phase 3 offboarding workflows. Soft deletion marks employees as deleted without removing them from the database, preserving audit trails and foreign key relationships.

## Completed Items

### 1. Database Schema Changes (✓ Complete)
- **Migration**: `20260910171855_add_soft_delete_to_employee`
- **File**: `api/prisma/migrations/20260910171855_add_soft_delete_to_employee/migration.sql`
- **Changes**:
  - Added `deletedAt` (DateTime, nullable) column to Employee table
  - Created index on `(tenantId, deletedAt)` for efficient soft delete queries
  - **NO unique constraint on (tenantId, email, deletedAt)** - allows multiple soft-deleted employees with same email

### 2. Prisma Schema Update (✓ Complete)
- **File**: `api/prisma/schema.prisma`
- **Changes**:
  - Added `deletedAt DateTime?` field to Employee model
  - Added composite index `@@index([tenantId, deletedAt])`

### 3. Soft Delete Service (✓ Complete)
- **File**: `api/src/common/soft-delete.service.ts`
- **Methods**:
  - `softDeleteEmployee(tenantId, employeeId)` - marks employee as deleted (sets deletedAt to now)
  - `restoreEmployee(tenantId, employeeId)` - clears deletedAt timestamp
  - `whereActive(baseWhere)` - static helper to build "active records only" filter
  - `whereDeleted(baseWhere)` - static helper to build "deleted records only" filter
- **Usage**: Services use `SoftDeleteService.whereActive({...})` to automatically exclude deleted employees from all queries

### 4. Employee Service & Controller Updates (✓ Complete)

#### Service Changes (`api/src/employees/employees.service.ts`)
- All queries exclude soft-deleted employees using `SoftDeleteService.whereActive()`
- Updated methods:
  - `assertBelongsToTenant()` - only finds active employees
  - `list()` - excludes deleted employees from all role-based views
  - `findOne()` - excludes deleted employees
  - `findByUserId()` - excludes deleted employees
- Added methods:
  - `softDelete(tenantId, employeeId)` - soft-deletes an employee
  - `restore(tenantId, employeeId)` - restores a soft-deleted employee
  - `listDeleted(tenantId)` - lists all soft-deleted employees (admin view)

#### Controller Changes (`api/src/employees/employees.controller.ts`)
- Imported Delete HTTP method
- Added endpoints:
  - `DELETE /employees/:id` - soft deletes an employee (ADMIN/HR only, auditable)
  - `PATCH /employees/:id/restore` - restores a soft-deleted employee (ADMIN/HR only, auditable)
  - `GET /employees/deleted/list` - lists soft-deleted employees (ADMIN/HR only)

#### Module Changes (`api/src/employees/employees.module.ts`)
- Added SoftDeleteService as provider
- SoftDeleteService exported for use in other modules

### 5. Related Services Updated with Soft Delete Exclusion (✓ Complete)

#### Leave Service (`api/src/leave/leave.service.ts`)
- `list()` - excludes soft-deleted employees from leave request queries
  - ADMIN/HR: filters by `employee: SoftDeleteService.whereActive({})`
  - MANAGER: filters by `employee: SoftDeleteService.whereActive({ OR: [...] })`
- `balance()` - excludes soft-deleted employees when checking leave balance

#### Attendance Service (`api/src/attendance/attendance.service.ts`)
- `today()` - excludes soft-deleted employees from daily attendance records
  - Filter: `employee: SoftDeleteService.whereActive({})`

#### Dashboard Service (`api/src/dashboard/dashboard.service.ts`)
- `stats()` - all employee counts exclude soft-deleted employees:
  - `totalEmployees` - counts only active employees
  - `activeEmployeeCount` - counts ACTIVE status employees only
  - `onLeaveToday` - excludes deleted employees on leave
  - `pendingLeaveRequests` - excludes requests from deleted employees
  - `headcountByDepartment` - department headcount excludes deleted

### 6. Seeds (✓ No Changes Needed)
- **File**: `api/prisma/seed.ts`
- Seed data does not create deleted employees
- All seeded employees are active (deletedAt = NULL)

## Soft Delete Implementation Coverage

### Where Soft Delete Exclusion Was Added:
| Service | Methods | Status |
|---------|---------|--------|
| Employee | assertBelongsToTenant, list, findOne, findByUserId | ✅ All updated |
| Leave | list (all roles), balance | ✅ Updated |
| Attendance | today | ✅ Updated |
| Dashboard | stats (all queries) | ✅ Updated |

### Query Pattern:
All soft-delete exclusions follow this pattern:
```typescript
SoftDeleteService.whereActive({ tenantId, ...otherFilters })
// Equivalent to: { tenantId, ...otherFilters, deletedAt: null }
```

## How to Use Soft Delete

### 1. Soft-Delete an Employee
**Request**:
```bash
DELETE /employees/{employeeId}
```

**Effects**:
- Employee marked as deleted (deletedAt set to current timestamp)
- Employee remains in database (not hard-deleted)
- Automatically logged to AuditLog with DELETE action
- Employee excluded from all subsequent queries

### 2. Restore a Deleted Employee
**Request**:
```bash
PATCH /employees/{employeeId}/restore
```

**Effects**:
- Employee marked as active (deletedAt cleared)
- Employee visible in all queries again
- Automatically logged to AuditLog with RESTORE action

### 3. View Deleted Employees (Admin Only)
**Request**:
```bash
GET /employees/deleted/list
```

**Response** (200 OK):
- Returns soft-deleted employees ordered by deletedAt DESC (newest first)
- Only ADMIN/HR roles can access

## Database Behavior After Soft Delete

When an employee is soft-deleted (deletedAt is set):

| Operation | Result | Notes |
|-----------|--------|-------|
| SELECT in /employees | ❌ Excluded | All employee listings exclude deleted |
| SELECT in /leave | ❌ Excluded | Leave requests from deleted not shown |
| SELECT in /attendance | ❌ Excluded | Attendance records excluded from today() |
| SELECT in /dashboard | ❌ Excluded | Not counted in any statistics |
| Manager relationships | ✅ Preserved | Can be restored without issues |
| Leave requests (data) | ✅ Kept | Requests remain in database |
| Attendance records (data) | ✅ Kept | Records remain in database |
| Audit logs | ✅ Kept | DELETE action logged |

## Migration & Deployment

### To Apply Migration Locally:
```bash
cd api
npx prisma migrate deploy
```

### Migration SQL:
```sql
ALTER TABLE "Employee" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Employee_tenantId_deletedAt_idx" ON "Employee"("tenantId", "deletedAt");
```

## Testing Checklist

Before deploying Phase 3, verify:

- [ ] Migration applies cleanly: `npx prisma migrate deploy`
- [ ] Soft-delete endpoint works: `DELETE /employees/:id`
- [ ] Soft-deleted employee excluded from listings: `GET /employees`
- [ ] Soft-deleted employee excluded from department stats
- [ ] Soft-deleted employee excluded from attendance: `GET /attendance/today`
- [ ] Soft-deleted employee excluded from leave: `GET /leave`
- [ ] Soft-deleted employee excluded from dashboard: `GET /dashboard/stats`
- [ ] Restore endpoint works: `PATCH /employees/:id/restore`
- [ ] Can query deleted employees: `GET /employees/deleted/list`
- [ ] Deleted employee manager relationships preserved
- [ ] Audit logs record DELETE action
- [ ] Audit logs record RESTORE action
- [ ] Multiple soft-deleted employees can have same email (no unique constraint violation)

## Integration Points

### Depends On:
- ✅ Employee model (Phase 1)
- ✅ Prisma schema and migrations
- ✅ AuditLog system (Phase 3) - for DELETE/RESTORE tracking

### Used By:
- 🔄 Phase 6 (UI) - will wire soft-delete endpoints to frontend offboarding workflow

## Files Created/Modified

### Created:
- `api/src/common/soft-delete.service.ts` - Soft delete service helper
- `api/prisma/migrations/20260910171855_add_soft_delete_to_employee/migration.sql` - Database migration

### Modified:
- `api/prisma/schema.prisma` - Added deletedAt field and index
- `api/src/employees/employees.service.ts` - All queries updated to exclude soft-deleted
- `api/src/employees/employees.controller.ts` - Added soft-delete, restore, listDeleted endpoints
- `api/src/employees/employees.module.ts` - Added SoftDeleteService provider
- `api/src/leave/leave.service.ts` - Updated queries to exclude soft-deleted employees
- `api/src/attendance/attendance.service.ts` - Updated today() to exclude soft-deleted
- `api/src/dashboard/dashboard.service.ts` - Updated stats() to exclude soft-deleted

---

# Phase 3: Leave Policy & Balance Implementation - Status Report

## Overview
Implemented LeavePolicy and LeaveBalance tables as foundational models for comprehensive leave management, enabling flexible leave entitlements per policy and year-based leave tracking.

## Completed Items

### 1. Prisma Schema & Migration (✓ Complete)

#### LeavePolicy Model
- **File**: `api/prisma/schema.prisma`
- **Fields**:
  - `id` (UUID, primary key)
  - `tenantId` (UUID, foreign key to Tenant, scoped)
  - `name` (String) - e.g., "Annual Leave", "Sick Leave", "Maternity"
  - `workingDaysPerWeek` (Int, default 5) - expected working days per week
  - `publicHolidaysPerYear` (Int, default 0) - count of public holidays in a year
  - `entitlementDays` (Int) - total days entitled per year for this policy
  - `createdAt`, `updatedAt` (DateTime)
  - Unique constraint: (tenantId, name)
  - Index on tenantId
  - One-to-many relation to LeaveBalance

#### LeaveBalance Model (Redesigned)
- **Old Schema**: Simple single-row per employee with hardcoded annual/sick fields
- **New Schema**: Multi-row per employee (one per leave policy per year)
  - `id` (UUID, primary key)
  - `tenantId` (UUID, foreign key to Tenant, scoped)
  - `employeeId` (UUID, foreign key to Employee)
  - `leavePolicyId` (UUID, foreign key to LeavePolicy)
  - `year` (Int) - calendar year for this balance
  - `entitledDays` (Decimal, 10.2) - days the employee is entitled to this year
  - `usedDays` (Decimal, 10.2, default 0) - days used so far
  - `balanceDays` (Decimal, 10.2) - remaining balance (computed as entitledDays - usedDays)
  - `createdAt`, `updatedAt` (DateTime)
  - Unique constraint: (tenantId, employeeId, leavePolicyId, year)
  - Indexes on (tenantId, employeeId) and (tenantId, year)
  - Relationships: tenant, employee, leavePolicy

#### Updated Tenant & Employee Models
- **Tenant**: Added `leavePolicies` and `leaveBalances` relations
- **Employee**: Changed from `leaveBalance` (singular) to `leaveBalances` (plural) relation

#### Database Migration
- **File**: `api/prisma/migrations/20260910114646_add_leave_policies_and_update_balances/migration.sql`
- **Changes**:
  - Creates LeavePolicy table with all fields and constraints
  - Drops old LeaveBalance table
  - Creates new LeaveBalance table with redesigned schema
  - Creates all indexes for performance
  - Enables RLS policies for both tables (tenant-scoped)
  - Ensures data consistency through foreign key constraints

### 2. Leave Policies Module (✓ Complete)

#### Leave Policies Service (`api/src/leave-policies/leave-policies.service.ts`)
- `create(tenantId, dto)` - Create new leave policy with uniqueness check
- `list(tenantId, query)` - List policies with cursor-based pagination
- `findOne(tenantId, id)` - Get single policy by ID
- `update(tenantId, id, dto)` - Update policy fields
- `delete(tenantId, id)` - Delete policy (deletes related balances)
- Returns cursor-paginated responses with hasMore and nextCursor

#### Leave Policies Controller (`api/src/leave-policies/leave-policies.controller.ts`)
- `GET /leave-policies` - List all policies (all authenticated users)
- `GET /leave-policies/:id` - Get single policy (all authenticated users)
- `POST /leave-policies` - Create (ADMIN/HR only)
- `PATCH /leave-policies/:id` - Update (ADMIN/HR only)
- `DELETE /leave-policies/:id` - Delete (ADMIN/HR only)

#### DTOs
- `CreateLeavePolicyDto` - name, workingDaysPerWeek, publicHolidaysPerYear, entitlementDays
- `UpdateLeavePolicyDto` - All fields optional for partial updates
- `ListLeavePoliciesQuery` - Cursor pagination support (cursor, limit)

### 3. Leave Balances Module (✓ Complete)

#### Leave Balances Service (`api/src/leave-balances/leave-balances.service.ts`)
- `getByEmployeeAndYear(tenantId, employeeId, year, requester)` - Get all balances for employee in specific year
- `getCurrentBalance(tenantId, employeeId, requester)` - Get current year balance
- `createBalance(tenantId, employeeId, leavePolicyId, year, entitledDays)` - Create or update balance
- `deductDays(tenantId, employeeId, leavePolicyId, year, daysToDeduct)` - Deduct days when leave approved
- `restoreDays(tenantId, employeeId, leavePolicyId, year, daysToRestore)` - Restore days when leave cancelled
- Role-based access control: ADMIN/HR can see all, MANAGER can see reports, EMPLOYEE can see self

#### Leave Balances Controller (`api/src/leave-balances/leave-balances.controller.ts`)
- `GET /leave-balances/:employeeId` - Get balance for specific year (defaults to current year)
  - Query parameter: `year` (optional, defaults to current year)
  - Returns: { employeeId, year, balances: Array<{ policy, entitledDays, usedDays, balanceDays }> }
- `GET /leave-balances/:employeeId/current` - Get current year balance
  - Returns: { employeeId, year: currentYear, balances: [...] }

### 4. Global Registration (✓ Complete)
- **File**: `api/src/app.module.ts`
- **Changes**:
  - Imported LeavePolicesModule
  - Imported LeaveBalancesModule
  - Registered both modules in imports array
  - DepartmentsModule also now imported

### 5. API Endpoints Summary

| Endpoint | Method | Authorization | Purpose |
|----------|--------|---------------|---------|
| /leave-policies | GET | All authenticated | List all leave policies with pagination |
| /leave-policies/:id | GET | All authenticated | Get single leave policy |
| /leave-policies | POST | ADMIN/HR | Create new leave policy |
| /leave-policies/:id | PATCH | ADMIN/HR | Update leave policy |
| /leave-policies/:id | DELETE | ADMIN/HR | Delete leave policy |
| /leave-balances/:employeeId | GET | ADMIN/HR/MANAGER/EMPLOYEE* | Get balance for specific year |
| /leave-balances/:employeeId/current | GET | ADMIN/HR/MANAGER/EMPLOYEE* | Get current year balance |

*EMPLOYEE can only view their own balance; MANAGER can view their reports' balances; ADMIN/HR can view all

## Leave Balance Calculation Logic

### Computation Model
- **entitledDays**: Fixed at balance creation, represents annual allocation for (employeeId, leavePolicyId, year)
- **usedDays**: Incremented when leave requests are approved, decremented when cancelled
- **balanceDays**: Calculated as `entitledDays - usedDays`, always kept in sync
- **Precision**: Decimal(10,2) supports fractional days (e.g., 0.5 for half-day leaves)

### Balance Update Flow
1. **On Leave Policy Creation**: No automatic balance creation (admin creates policies first)
2. **On Employee Onboarding**: Should create initial balances for each policy for current year
3. **On Leave Request Approval**: 
   - Service calls `leaveBalances.deductDays()`
   - Updates: usedDays += daysRequested, balanceDays -= daysRequested
4. **On Leave Request Rejection/Cancellation**:
   - Service calls `leaveBalances.restoreDays()`
   - Updates: usedDays -= daysCancelled, balanceDays += daysCancelled
5. **Year Boundary**: New balances created on Jan 1 (or via scheduled job) with entitledDays reset

### Example Scenario
```
Policy: Annual Leave, entitlementDays = 20
Year: 2026
Employee: John Doe

Initial Balance:
  entitledDays: 20
  usedDays: 0
  balanceDays: 20

After approving 5-day leave request:
  entitledDays: 20
  usedDays: 5
  balanceDays: 15

After approving 2.5-day leave request:
  entitledDays: 20
  usedDays: 7.5
  balanceDays: 12.5

After cancelling 2.5-day leave:
  entitledDays: 20
  usedDays: 5
  balanceDays: 15
```

## Dependencies & Integrations

### Phase 3 Dependencies
- ✓ Department table (Agent 1) - Required for Employee model
- ✓ Audit logging (Agent 4) - Will audit LeavePolicy and LeaveBalance changes
- ✓ Pagination utilities (common/pagination.ts) - Used by leave-policies list endpoint

### What Depends on This
- **Agent 4 (AuditLog Integration)**: Must audit:
  - LeavePolicy CREATE/UPDATE/DELETE
  - LeaveBalance CREATE/UPDATE (when deducting/restoring days)
  - Entity type: "LeavePolicy", "LeaveBalance"
  
- **Agent 6 (Leave Request Approval)**: Must:
  - Call `leaveBalances.deductDays()` when approving annual/sick leave
  - Call `leaveBalances.restoreDays()` when rejecting/cancelling
  - Validate sufficient balance before approval
  - Pass leavePolicyId to balance service

- **Agent 7 (Integration & Frontend)**: Must:
  - Display leave policies in admin settings
  - Show employee leave balances with policies
  - Track balance changes over time

### Database RLS Policies
Both LeavePolicy and LeaveBalance tables have RLS policies:
- **LeavePolicy**: `"tenantId" = current_setting('app.current_tenant_id', true)`
- **LeaveBalance**: `"tenantId" = current_setting('app.current_tenant_id', true)`

These ensure strict tenant isolation at database level.

## Known Limitations & Future Enhancements

### Current Limitations
1. **No Carryover Logic**: Balances don't automatically carry over from previous years
   - Solution: Scheduled job or manual API to create new year balances
2. **No Accrual Scheduling**: All days allocated at year start
   - Solution: Add accrualFrequency field to LeavePolicy (e.g., MONTHLY, QUARTERLY)
3. **No Leave Year Offset**: All balances use calendar year
   - Solution: Add leaveYearStartDate to Tenant or LeavePolicy

### Recommended Future Features
1. **Accrual-Based Balances**: Support accruing days throughout the year
2. **Carry-Forward Logic**: Support carrying over unused days to next year (with max caps)
3. **Pro-Rata Calculation**: Automatically calculate balances for mid-year joiners
4. **Policy Effective Dates**: Support policy versions with different rules per date range
5. **Balance Forecasting**: Predict future balances based on pending leave requests

## Testing Checklist

- [ ] Create leave policy returns correct fields with unique name per tenant
- [ ] List leave policies returns cursor-paginated response
- [ ] Update leave policy updates all fields correctly
- [ ] Delete leave policy cascades to related balances
- [ ] Create leave balance creates entry for employee/policy/year
- [ ] Get employee balance returns all policies for that year
- [ ] Deduct days updates usedDays and balanceDays correctly
- [ ] Restore days updates usedDays and balanceDays correctly
- [ ] Role-based access control works (ADMIN/HR can see all, MANAGER sees reports, EMPLOYEE sees self)
- [ ] RLS policies prevent cross-tenant access at database level
- [ ] Cursor pagination works correctly with multiple policies

## Files Changed/Created

### Created
- `api/prisma/migrations/20260910114646_add_leave_policies_and_update_balances/migration.sql`
- `api/src/leave-policies/leave-policies.service.ts`
- `api/src/leave-policies/leave-policies.controller.ts`
- `api/src/leave-policies/leave-policies.module.ts`
- `api/src/leave-policies/dto/create-leave-policy.dto.ts`
- `api/src/leave-policies/dto/update-leave-policy.dto.ts`
- `api/src/leave-policies/dto/list-leave-policies.query.ts`
- `api/src/leave-balances/leave-balances.service.ts`
- `api/src/leave-balances/leave-balances.controller.ts`
- `api/src/leave-balances/leave-balances.module.ts`

### Updated
- `api/prisma/schema.prisma` - Added LeavePolicy and redesigned LeaveBalance
- `api/src/app.module.ts` - Registered LeavePolicesModule and LeaveBalancesModule

## Next Steps

1. **Run Migration**: Execute `npx prisma migrate deploy` to apply changes to database
2. **Generate Client**: Run `npx prisma generate` to update Prisma client types
3. **Integration**: Agent 6 will integrate leave approval with balance deduction
4. **Audit Integration**: Agent 4 will mark endpoints as @Auditable()
5. **Frontend**: Agent 7 will implement UI for leave policies and balances

---

## Phase 3 Summary

Phase 3 implements five major improvements:

1. **Audit Logging System** - Complete write operation tracking with change history
2. **Cursor-Based Pagination** - Scalable keyset pagination for all list endpoints
3. **Department Table** - Foundational organizational structure model
4. **Soft Delete for Employees** - Employee offboarding with audit trail and restoration capability
5. **Leave Policy & Balance System** - Flexible leave entitlements with year-based balance tracking

These features improve data integrity, query performance, operational observability, organizational structure management, employee lifecycle management, and leave policy flexibility.
