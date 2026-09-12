import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { EmployeesService } from '../src/employees/employees.service.js';
import { LeaveService } from '../src/leave/leave.service.js';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Critical Path E2E Tests
 *
 * Tests the complete workflow:
 * 1. Tenant registration
 * 2. User login
 * 3. Employee creation
 * 4. Leave request creation
 * 5. Leave request approval
 */

describe('Critical Path Workflow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let employeesService: EmployeesService;
  let leaveService: LeaveService;

  // Test data holders
  let adminUser: any;
  let adminToken: string;
  let regularEmployee: any;
  let managerUser: any;
  let managerToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);
    employeesService = moduleFixture.get<EmployeesService>(EmployeesService);
    leaveService = moduleFixture.get<LeaveService>(LeaveService);
  });

  afterAll(async () => {
    // Cleanup test data
    if (tenantId) {
      // Delete in correct order to respect foreign key constraints
      await prisma.leaveRequest.deleteMany({ where: { tenantId } });
      await prisma.leaveBalance.deleteMany({ where: { tenantId } });
      await prisma.refreshToken.deleteMany({ where: { user: { tenantId } } });
      await prisma.passwordSetToken.deleteMany({ where: { user: { tenantId } } });
      await prisma.employee.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }

    await app.close();
  });

  describe('Phase 1: Tenant Registration & Admin Authentication', () => {
    it('should register a new tenant with admin user', async () => {
      const registerDto = {
        email: 'admin@testcompany.com',
        password: 'SecurePassword123!',
        fullName: 'Admin User',
        companyName: 'Test Company',
      };

      const result = await authService.register(registerDto);

      expect(result).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.profile.email).toBe('admin@testcompany.com');
      expect(result.profile.role).toBe('ADMIN');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      adminUser = result.profile;
      adminToken = result.accessToken;
      tenantId = result.profile.tenant.id;
    });

    it('should prevent duplicate email registration', async () => {
      const registerDto = {
        email: 'admin@testcompany.com',
        password: 'AnotherPassword123!',
        fullName: 'Another Admin',
        companyName: 'Another Company',
      };

      await expect(authService.register(registerDto)).rejects.toThrow('An account with this email already exists');
    });

    it('should login admin user with correct credentials', async () => {
      const loginDto = {
        email: 'admin@testcompany.com',
        password: 'SecurePassword123!',
      };

      const result = await authService.login(loginDto);

      expect(result.profile).toBeDefined();
      expect(result.profile.email).toBe('admin@testcompany.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject login with incorrect password', async () => {
      const loginDto = {
        email: 'admin@testcompany.com',
        password: 'WrongPassword123!',
      };

      await expect(authService.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should reject login for non-existent user', async () => {
      const loginDto = {
        email: 'nonexistent@testcompany.com',
        password: 'SomePassword123!',
      };

      await expect(authService.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should refresh access token with valid refresh token', async () => {
      const loginResult = await authService.login({
        email: 'admin@testcompany.com',
        password: 'SecurePassword123!',
      });

      const refreshResult = await authService.refresh(loginResult.refreshToken);

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.accessToken).not.toBe(loginResult.accessToken);
      expect(refreshResult.profile.email).toBe('admin@testcompany.com');
    });

    it('should reject refresh with invalid token', async () => {
      await expect(authService.refresh('invalid-token')).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('Phase 2: Employee Management', () => {
    it('should create a new employee', async () => {
      const createEmployeeDto = {
        name: 'John Employee',
        email: 'john@testcompany.com',
        title: 'Software Engineer',
        location: 'New York',
        joinDate: new Date().toISOString().split('T')[0],
        phone: '+1234567890',
      };

      regularEmployee = await employeesService.create(tenantId, createEmployeeDto);

      expect(regularEmployee).toBeDefined();
      expect(regularEmployee.id).toBeDefined();
      expect(regularEmployee.name).toBe('John Employee');
      expect(regularEmployee.email).toBe('john@testcompany.com');
      expect(regularEmployee.title).toBe('Software Engineer');
      expect(regularEmployee.status).toBe('ACTIVE');
    });

    it('should create a manager employee', async () => {
      const createManagerDto = {
        name: 'Jane Manager',
        email: 'jane@testcompany.com',
        title: 'Engineering Manager',
        location: 'San Francisco',
        joinDate: new Date().toISOString().split('T')[0],
        phone: '+1987654321',
      };

      managerUser = await employeesService.create(tenantId, createManagerDto);

      expect(managerUser).toBeDefined();
      expect(managerUser.id).toBeDefined();
      expect(managerUser.name).toBe('Jane Manager');
    });

    it('should set manager relationship for employee', async () => {
      const updateDto = {
        managerId: managerUser.id,
      };

      const updated = await employeesService.update(tenantId, regularEmployee.id, updateDto);

      expect(updated.managerId).toBe(managerUser.id);
    });

    it('should list employees with pagination', async () => {
      const jwtPayload = {
        sub: adminUser.id,
        tenantId,
        email: adminUser.email,
        role: 'ADMIN',
      };

      const result = await employeesService.list(tenantId, jwtPayload, { limit: 10 });

      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.hasMore).toBeDefined();
    });

    it('should find employee by ID', async () => {
      const found = await employeesService.findOne(tenantId, regularEmployee.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(regularEmployee.id);
      expect(found.name).toBe('John Employee');
    });

    it('should find employee by user ID', async () => {
      // Create a new user and employee
      const registerDto = {
        email: 'employee2@testcompany.com',
        password: 'Password123!',
        fullName: 'Employee Two',
        companyName: 'Test Company', // This will create a new tenant - need to use existing
      };

      // Instead, we'll manually create an employee linked to the admin
      const employee = await prisma.employee.create({
        data: {
          tenantId,
          userId: adminUser.id, // Link to admin user
          name: 'Admin Employee Record',
          email: 'admin@testcompany.com',
          title: 'Administrator',
          location: 'HQ',
          status: 'ACTIVE',
          joinDate: new Date(),
          phone: '+1111111111',
          leaveBalance: { create: {} },
        },
      });

      const found = await employeesService.findByUserId(tenantId, adminUser.id);

      expect(found).toBeDefined();
      expect(found.userId).toBe(adminUser.id);
    });

    it('should return 404 for non-existent employee', async () => {
      await expect(employeesService.findOne(tenantId, 'non-existent-id')).rejects.toThrow('Employee not found');
    });
  });

  describe('Phase 3: Leave Request Workflow', () => {
    it('should create a leave request', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000); // 3 days

      const createLeaveDto = {
        type: 'ANNUAL',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Vacation time',
      };

      const leaveRequest = await leaveService.create(tenantId, regularEmployee.userId, createLeaveDto);

      expect(leaveRequest).toBeDefined();
      expect(leaveRequest.id).toBeDefined();
      expect(leaveRequest.employeeId).toBe(regularEmployee.id);
      expect(leaveRequest.type).toBe('ANNUAL');
      expect(leaveRequest.days).toBe(3);
      expect(leaveRequest.status).toBe('PENDING');
    });

    it('should reject leave request with invalid date range', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() + 2 * 24 * 60 * 60 * 1000); // Start after end

      const createLeaveDto = {
        type: 'ANNUAL',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Invalid vacation',
      };

      await expect(leaveService.create(tenantId, regularEmployee.userId, createLeaveDto)).rejects.toThrow(
        'endDate must be on or after startDate',
      );
    });

    it('should list leave requests by role', async () => {
      const adminPayload = {
        sub: adminUser.id,
        tenantId,
        email: adminUser.email,
        role: 'ADMIN' as const,
      };

      const result = await leaveService.list(tenantId, adminPayload, { limit: 10 });

      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should only allow employee to see own leave requests', async () => {
      const employeePayload = {
        sub: regularEmployee.userId,
        tenantId,
        email: regularEmployee.email,
        role: 'EMPLOYEE' as const,
      };

      const result = await leaveService.list(tenantId, employeePayload, { limit: 10 });

      // Should only see own requests
      expect(result.items).toBeDefined();
      result.items.forEach((request: any) => {
        expect(request.employeeId).toBe(regularEmployee.id);
      });
    });
  });

  describe('Phase 4: Leave Approval Workflow', () => {
    let leaveRequestForApproval: any;

    it('should create leave request to be approved', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);

      const createLeaveDto = {
        type: 'SICK',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Sick leave',
      };

      leaveRequestForApproval = await leaveService.create(tenantId, regularEmployee.userId, createLeaveDto);

      expect(leaveRequestForApproval.status).toBe('PENDING');
    });

    it('should approve leave request as ADMIN', async () => {
      const adminPayload = {
        sub: adminUser.id,
        tenantId,
        email: adminUser.email,
        role: 'ADMIN' as const,
      };

      const approved = await leaveService.decide(tenantId, leaveRequestForApproval.id, adminPayload, true);

      expect(approved.status).toBe('APPROVED');
      expect(approved.decidedAt).toBeDefined();
      expect(approved.decidedBy).toBe(adminUser.id);
    });

    it('should reject leave request', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);

      const createLeaveDto = {
        type: 'ANNUAL',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Annual leave',
      };

      const leaveRequest = await leaveService.create(tenantId, regularEmployee.userId, createLeaveDto);

      const adminPayload = {
        sub: adminUser.id,
        tenantId,
        email: adminUser.email,
        role: 'ADMIN' as const,
      };

      const rejected = await leaveService.decide(tenantId, leaveRequest.id, adminPayload, false);

      expect(rejected.status).toBe('REJECTED');
    });

    it('should prevent double-approval of leave request', async () => {
      const adminPayload = {
        sub: adminUser.id,
        tenantId,
        email: adminUser.email,
        role: 'ADMIN' as const,
      };

      await expect(leaveService.decide(tenantId, leaveRequestForApproval.id, adminPayload, true)).rejects.toThrow(
        'This request has already been decided',
      );
    });

    it('should prevent employee from approving own request', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000);

      const createLeaveDto = {
        type: 'ANNUAL',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Own leave',
      };

      const leaveRequest = await leaveService.create(tenantId, regularEmployee.userId, createLeaveDto);

      // Create a user linked to regularEmployee
      const userForEmployee = await prisma.user.create({
        data: {
          tenantId,
          email: `employee-user-${Date.now()}@testcompany.com`,
          passwordHash: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      await prisma.employee.update({
        where: { id: regularEmployee.id },
        data: { userId: userForEmployee.id },
      });

      const employeePayload = {
        sub: userForEmployee.id,
        tenantId,
        email: regularEmployee.email,
        role: 'EMPLOYEE' as const,
      };

      await expect(leaveService.decide(tenantId, leaveRequest.id, employeePayload, true)).rejects.toThrow(
        'You cannot approve or reject your own leave request',
      );
    });
  });

  describe('Phase 5: Leave Balance Tracking', () => {
    it('should retrieve leave balance for employee', async () => {
      const adminPayload = {
        sub: adminUser.id,
        tenantId,
        email: adminUser.email,
        role: 'ADMIN' as const,
      };

      const balance = await leaveService.balance(tenantId, regularEmployee.id, adminPayload);

      expect(balance).toBeDefined();
      expect(balance.employeeId).toBe(regularEmployee.id);
      expect(balance.entitledDays).toBeDefined();
      expect(balance.usedDays).toBeDefined();
    });

    it('should prevent non-manager from viewing others balance', async () => {
      // Create another employee
      const otherEmployeeDto = {
        name: 'Other Employee',
        email: `other-${Date.now()}@testcompany.com`,
        title: 'Developer',
        location: 'Remote',
        joinDate: new Date().toISOString().split('T')[0],
        phone: '+9999999999',
      };

      const otherEmployee = await employeesService.create(tenantId, otherEmployeeDto);

      const otherUser = await prisma.user.create({
        data: {
          tenantId,
          email: `other-user-${Date.now()}@testcompany.com`,
          passwordHash: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      await prisma.employee.update({
        where: { id: otherEmployee.id },
        data: { userId: otherUser.id },
      });

      const employeePayload = {
        sub: otherUser.id,
        tenantId,
        email: otherEmployee.email,
        role: 'EMPLOYEE' as const,
      };

      // Try to view regularEmployee's balance
      await expect(leaveService.balance(tenantId, regularEmployee.id, employeePayload)).rejects.toThrow(
        "You cannot view this employee's leave balance",
      );
    });
  });

  describe('Integration: Full Workflow', () => {
    it('should complete full workflow: register -> login -> create employee -> create leave -> approve', async () => {
      // 1. Register new tenant
      const registerDto = {
        email: 'workflow@company.com',
        password: 'WorkflowTest123!',
        fullName: 'Workflow Admin',
        companyName: 'Workflow Company',
      };

      const { profile, accessToken } = await authService.register(registerDto);
      const workflowTenantId = profile.tenant.id;

      expect(profile.role).toBe('ADMIN');

      // 2. Login to verify session
      const loginResult = await authService.login({
        email: 'workflow@company.com',
        password: 'WorkflowTest123!',
      });

      expect(loginResult.accessToken).toBeDefined();

      // 3. Create employee
      const employeeDto = {
        name: 'Workflow Employee',
        email: 'workflow-emp@company.com',
        title: 'Test Role',
        location: 'Remote',
        joinDate: new Date().toISOString().split('T')[0],
        phone: '+1111111111',
      };

      const workflowEmployee = await employeesService.create(workflowTenantId, employeeDto);

      expect(workflowEmployee.id).toBeDefined();

      // 4. Create leave request
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000);

      const leaveDto = {
        type: 'ANNUAL',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reason: 'Complete workflow test',
      };

      // Need user linked to employee for leave creation
      const empUser = await prisma.user.create({
        data: {
          tenantId: workflowTenantId,
          email: `workflow-emp-user-${Date.now()}@company.com`,
          passwordHash: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      await prisma.employee.update({
        where: { id: workflowEmployee.id },
        data: { userId: empUser.id },
      });

      const leaveRequest = await leaveService.create(workflowTenantId, empUser.id, leaveDto);

      expect(leaveRequest.status).toBe('PENDING');

      // 5. Approve leave
      const adminPayload = {
        sub: profile.id,
        tenantId: workflowTenantId,
        email: profile.email,
        role: 'ADMIN' as const,
      };

      const approved = await leaveService.decide(workflowTenantId, leaveRequest.id, adminPayload, true);

      expect(approved.status).toBe('APPROVED');

      // Cleanup
      await prisma.leaveRequest.deleteMany({ where: { tenantId: workflowTenantId } });
      await prisma.leaveBalance.deleteMany({ where: { tenantId: workflowTenantId } });
      await prisma.refreshToken.deleteMany({ where: { user: { tenantId: workflowTenantId } } });
      await prisma.passwordSetToken.deleteMany({ where: { user: { tenantId: workflowTenantId } } });
      await prisma.employee.deleteMany({ where: { tenantId: workflowTenantId } });
      await prisma.user.deleteMany({ where: { tenantId: workflowTenantId } });
      await prisma.tenant.delete({ where: { id: workflowTenantId } });
    });
  });
});
